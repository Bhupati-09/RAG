"""SQLite metadata storage and startup migration logic."""
from __future__ import annotations

import json
import logging
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Generator

from app.core import config
from app.core.config import MISSING_INDEXED_VECTORS_ERROR

logger = logging.getLogger("rag-backend.metadata")

document_registry: dict[str, dict[str, Any]] = {}
registry_lock = threading.Lock()


@contextmanager
def metadata_connection(db_path: Path | None = None) -> Generator[sqlite3.Connection, None, None]:
    path = db_path or config.METADATA_DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=30)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def persist_documents(documents: list[dict[str, Any]], db_path: Path | None = None) -> None:
    with metadata_connection(db_path) as connection:
        connection.executemany(
            """
            INSERT INTO documents (
                document_id, filename, status, chunks, error, uploaded_at, file_path, size
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(document_id) DO UPDATE SET
                filename = excluded.filename,
                status = excluded.status,
                chunks = excluded.chunks,
                error = excluded.error,
                uploaded_at = excluded.uploaded_at,
                file_path = excluded.file_path,
                size = excluded.size
            """,
            [
                (
                    document["document_id"],
                    document["filename"],
                    document["status"],
                    document.get("chunks"),
                    document.get("error"),
                    document.get("uploaded_at"),
                    document.get("file_path"),
                    document.get("size", 0),
                )
                for document in documents
            ],
        )


def persist_document(document: dict[str, Any], db_path: Path | None = None) -> None:
    persist_documents([document], db_path)


def library_document_id(metadata: dict[str, Any]) -> str | None:
    library_id = metadata.get("library_document_id")
    if isinstance(library_id, str) and library_id:
        return library_id

    node_content = metadata.get("_node_content")
    if isinstance(node_content, str):
        try:
            node_metadata = json.loads(node_content).get("metadata", {})
        except (json.JSONDecodeError, AttributeError):
            node_metadata = {}
        if isinstance(node_metadata, dict):
            library_id = node_metadata.get("library_document_id") or node_metadata.get("document_id")
            if isinstance(library_id, str) and library_id:
                return library_id

    document_id = metadata.get("document_id")
    if isinstance(document_id, str) and document_id and document_id != metadata.get("ref_doc_id"):
        return document_id
    return None


def migrate_vector_metadata(document_rows: list[sqlite3.Row], chroma_collection: Any) -> None:
    document_ids_by_source = {
        str(Path(row["file_path"]).resolve()): str(row["document_id"])
        for row in document_rows
        if row["file_path"]
    }
    chunk_total = chroma_collection.count()
    for offset in range(0, chunk_total, 500):
        batch = chroma_collection.get(limit=500, offset=offset, include=["metadatas"])
        ids_to_update: list[str] = []
        metadata_to_update: list[dict[str, Any]] = []
        for chunk_id, metadata in zip(batch["ids"], batch["metadatas"], strict=True):
            if not metadata:
                continue
            node_content = metadata.get("_node_content")
            node_metadata: dict[str, Any] = {}
            if isinstance(node_content, str):
                try:
                    decoded_content = json.loads(node_content)
                except json.JSONDecodeError:
                    decoded_content = {}
                if isinstance(decoded_content, dict) and isinstance(
                    decoded_content.get("metadata"), dict
                ):
                    node_metadata = decoded_content["metadata"]
            source = metadata.get("source") or node_metadata.get("source")
            library_id = (
                document_ids_by_source.get(str(Path(source).resolve()))
                if isinstance(source, str) and source
                else None
            ) or library_document_id(metadata)
            if not library_id or metadata.get("library_document_id") == library_id:
                continue
            ids_to_update.append(chunk_id)
            metadata_to_update.append({**metadata, "library_document_id": library_id})
        if ids_to_update:
            chroma_collection.update(ids=ids_to_update, metadatas=metadata_to_update)


def restore_document_registry(
    chroma_collection: Any,
    db_path: Path | None = None,
    index_lock: threading.Lock | None = None,
) -> None:
    path = db_path or config.METADATA_DB_PATH
    with metadata_connection(path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS documents (
                document_id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                status TEXT NOT NULL,
                chunks INTEGER,
                error TEXT,
                uploaded_at TEXT,
                file_path TEXT NOT NULL,
                size INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        rows = connection.execute("SELECT * FROM documents").fetchall()

    migrate_vector_metadata(rows, chroma_collection)

    if not rows:
        legacy_documents: dict[str, dict[str, Any]] = {}
        chunk_total = chroma_collection.count()
        for offset in range(0, chunk_total, 500):
            batch = chroma_collection.get(
                limit=500,
                offset=offset,
                include=["metadatas"],
            )
            for metadata in batch["metadatas"]:
                doc_id = library_document_id(metadata or {})
                if not doc_id:
                    continue
                record = legacy_documents.get(doc_id)
                if record is None:
                    source = str(metadata.get("source", ""))
                    file_path = Path(source) if source else None
                    try:
                        file_stat = file_path.stat() if file_path else None
                    except OSError:
                        file_stat = None
                    record = {
                        "document_id": doc_id,
                        "filename": str(
                            metadata.get("filename")
                            or (file_path.name if file_path else doc_id)
                        ),
                        "status": "completed",
                        "chunks": 0,
                        "error": None,
                        "uploaded_at": (
                            datetime.fromtimestamp(file_stat.st_mtime, timezone.utc).isoformat()
                            if file_stat
                            else None
                        ),
                        "file_path": source,
                        "size": file_stat.st_size if file_stat else 0,
                    }
                    legacy_documents[doc_id] = record
                record["chunks"] += 1
        rows = list(legacy_documents.values())
        if rows:
            persist_documents(rows, path)
            logger.info("Migrated %d indexed documents from ChromaDB metadata", len(rows))

    def _delete_vecs(d_id: str) -> None:
        chroma_collection.delete(where={"library_document_id": d_id})

    for row in rows:
        document = dict(row)
        if document["status"] in {"queued", "processing"}:
            if index_lock:
                with index_lock:
                    _delete_vecs(document["document_id"])
            else:
                _delete_vecs(document["document_id"])
            document.update(
                status="failed",
                chunks=0,
                error="Indexing was interrupted by a backend restart. Upload the document again.",
            )
            persist_document(document, path)
        elif document["status"] == "completed":
            if index_lock:
                with index_lock:
                    indexed_chunks = len(
                        chroma_collection.get(
                            where={"library_document_id": document["document_id"]}
                        )["ids"]
                    )
            else:
                indexed_chunks = len(
                    chroma_collection.get(
                        where={"library_document_id": document["document_id"]}
                    )["ids"]
                )
            if indexed_chunks:
                document.update(chunks=indexed_chunks, error=None)
            else:
                document.update(
                    status="failed",
                    chunks=0,
                    error=MISSING_INDEXED_VECTORS_ERROR,
                )
            persist_document(document, path)
        elif document["status"] == "failed":
            indexed_chunks = len(
                chroma_collection.get(
                    where={"library_document_id": document["document_id"]}
                )["ids"]
            )
            if (
                indexed_chunks
                and document.get("error") == MISSING_INDEXED_VECTORS_ERROR
            ):
                document.update(status="completed", chunks=indexed_chunks, error=None)
            else:
                if index_lock:
                    with index_lock:
                        _delete_vecs(document["document_id"])
                else:
                    _delete_vecs(document["document_id"])
                document["chunks"] = 0
            persist_document(document, path)
        document_registry[document["document_id"]] = document

    logger.info("Restored %d document records from %s", len(document_registry), path)
