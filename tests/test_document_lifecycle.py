"""
Document lifecycle integration tests for the Knowledge IQ backend.

Verifies document upload, indexing, deletion, retry, migration, and
recovery from interrupted indexing using a fake ChromaDB collection.
"""
import os
import tempfile
import unittest
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

TEST_STORAGE = tempfile.TemporaryDirectory(prefix="knowledge-iq-unittest-")
TEST_ROOT = Path(TEST_STORAGE.name)
os.environ["CHROMA_DB_PATH"] = str(TEST_ROOT / "chroma")
os.environ["METADATA_DB_PATH"] = str(TEST_ROOT / "metadata.sqlite3")
os.environ["UPLOAD_DIR"] = str(TEST_ROOT / "uploads")

import main  # noqa: E402  — must import after env vars are set
from app.services import metadata_store  # noqa: E402
from app.services import vector_store as vs_mod  # noqa: E402
from app.api import routes as routes_mod  # noqa: E402
from fastapi import HTTPException  # noqa: E402


class FakeChromaCollection:
    def __init__(self) -> None:
        self.records: dict[str, dict[str, Any]] = {}

    def add(
        self,
        ids: list[str],
        documents: list[str],
        metadatas: list[dict[str, Any]],
        **_: Any,
    ) -> None:
        for chunk_id, text, metadata in zip(ids, documents, metadatas, strict=True):
            self.records[chunk_id] = {"document": text, "metadata": metadata}

    def count(self) -> int:
        return len(self.records)

    def get(
        self,
        where: dict[str, Any] | None = None,
        limit: int | None = None,
        offset: int = 0,
        **_: Any,
    ) -> dict[str, list[Any]]:
        records = [
            (chunk_id, record)
            for chunk_id, record in self.records.items()
            if not where
            or all(record["metadata"].get(key) == value for key, value in where.items())
        ]
        records = records[offset : offset + limit if limit is not None else None]
        return {
            "ids": [chunk_id for chunk_id, _ in records],
            "metadatas": [record["metadata"] for _, record in records],
        }

    def delete(
        self,
        ids: list[str] | None = None,
        where: dict[str, Any] | None = None,
    ) -> None:
        if where:
            ids = self.get(where=where)["ids"]
        for chunk_id in ids or []:
            self.records.pop(chunk_id, None)

    def update(
        self,
        ids: list[str],
        metadatas: list[dict[str, Any]],
        **_: Any,
    ) -> None:
        for chunk_id, metadata in zip(ids, metadatas, strict=True):
            self.records[chunk_id]["metadata"] = metadata


class DocumentLifecycleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory(prefix="document-test-")
        self.metadata_path = Path(self.temporary_directory.name) / "metadata.sqlite3"
        self.collection = FakeChromaCollection()

        # Patch registry, collection, and metadata path across all modules that use them
        self.registry_patch = patch.object(metadata_store, "document_registry", {})
        self.collection_patch_vs = patch.object(vs_mod, "chroma_collection", self.collection)
        self.collection_patch_rag = patch("app.services.rag_service.chroma_collection", self.collection)
        self.path_patch = patch.object(metadata_store, "config")
        self.main_registry = patch.object(main, "document_registry", metadata_store.document_registry)

        self.registry_patch.start()
        self.collection_patch_vs.start()
        self.collection_patch_rag.start()
        mock_config = self.path_patch.start()
        mock_config.METADATA_DB_PATH = self.metadata_path
        mock_config.MISSING_INDEXED_VECTORS_ERROR = main.MISSING_INDEXED_VECTORS_ERROR

        metadata_store.restore_document_registry(self.collection, db_path=self.metadata_path)

    def tearDown(self) -> None:
        self.path_patch.stop()
        self.collection_patch_rag.stop()
        self.collection_patch_vs.stop()
        self.registry_patch.stop()
        self.temporary_directory.cleanup()

    def test_migrates_legacy_chroma_records_and_removes_vectors(self) -> None:
        document_id = "legacy-document"
        self.collection.add(
            ids=["legacy-chunk-1", "legacy-chunk-2"],
            documents=["first passage", "second passage"],
            metadatas=[
                {"document_id": document_id, "filename": "guide.txt", "source": "/data/guide.txt"},
                {"document_id": document_id, "filename": "guide.txt", "source": "/data/guide.txt"},
            ],
        )

        metadata_store.restore_document_registry(self.collection, db_path=self.metadata_path)
        document = metadata_store.document_registry[document_id]
        self.assertEqual(document["status"], "completed")
        self.assertEqual(document["chunks"], 2)
        client = TestClient(main.app)
        listed = client.get("/documents")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.json()["total"], 1)

        removed = client.delete(f"/documents/{document_id}")
        self.assertEqual(removed.status_code, 200)
        self.assertEqual(removed.json()["status"], "removed")
        self.assertEqual(self.collection.count(), 0)
        self.assertEqual(client.get("/documents").json()["total"], 0)

    def test_interrupted_indexing_is_marked_failed_and_partial_vectors_are_removed(self) -> None:
        document_id = "interrupted-document"
        self.collection.add(
            ids=["partial-chunk"],
            documents=["partial passage"],
            metadatas=[{"document_id": document_id}],
        )
        metadata_store.persist_document(
            {
                "document_id": document_id,
                "filename": "interrupted.txt",
                "status": "processing",
                "chunks": None,
                "error": None,
                "uploaded_at": None,
                "file_path": "/data/interrupted.txt",
                "size": 16,
            },
            db_path=self.metadata_path,
        )

        metadata_store.restore_document_registry(self.collection, db_path=self.metadata_path)

        recovered = metadata_store.document_registry[document_id]
        self.assertEqual(recovered["status"], "failed")
        self.assertEqual(recovered["chunks"], 0)
        self.assertEqual(self.collection.count(), 0)

    def test_migrates_reserved_vector_document_id_and_removes_its_chunks(self) -> None:
        document_id = "library-document"
        chunk_id = "vector-node-id"
        self.collection.add(
            ids=[chunk_id],
            documents=["indexed passage"],
            metadatas=[
                {
                    "document_id": chunk_id,
                    "ref_doc_id": chunk_id,
                    "filename": "guide.pdf",
                    "_node_content": (
                        '{"metadata":{"document_id":"library-document",'
                        '"filename":"guide.pdf"}}'
                    ),
                }
            ],
        )
        metadata_store.persist_document(
            {
                "document_id": document_id,
                "filename": "guide.pdf",
                "status": "failed",
                "chunks": None,
                "error": "Previous indexing failed",
                "uploaded_at": None,
                "file_path": "/data/guide.pdf",
                "size": 20,
            },
            db_path=self.metadata_path,
        )
        metadata_store.document_registry[document_id] = {
            "document_id": document_id,
            "filename": "guide.pdf",
            "status": "failed",
            "chunks": None,
            "error": "Previous indexing failed",
            "uploaded_at": None,
            "file_path": "/data/guide.pdf",
            "size": 20,
        }

        metadata_store.restore_document_registry(self.collection, db_path=self.metadata_path)

        self.assertEqual(self.collection.count(), 0)
        self.assertEqual(metadata_store.document_registry[document_id]["chunks"], 0)

    def test_reconciles_legacy_vectors_by_source_when_registry_ids_differ(self) -> None:
        document_id = "current-registry-id"
        source = str(Path(self.temporary_directory.name) / "uploaded-guide.pdf")
        self.collection.add(
            ids=["legacy-vector"],
            documents=["indexed passage"],
            metadatas=[
                {
                    "document_id": "legacy-vector",
                    "ref_doc_id": "legacy-vector",
                    "filename": "guide.pdf",
                    "source": source,
                    "_node_content": (
                        '{"metadata":{"document_id":"old-registry-id",'
                        '"filename":"guide.pdf","source":"' + source + '"}}'
                    ),
                }
            ],
        )
        metadata_store.persist_document(
            {
                "document_id": document_id,
                "filename": "guide.pdf",
                "status": "failed",
                "chunks": 0,
                "error": main.MISSING_INDEXED_VECTORS_ERROR,
                "uploaded_at": None,
                "file_path": source,
                "size": 20,
            },
            db_path=self.metadata_path,
        )

        metadata_store.restore_document_registry(self.collection, db_path=self.metadata_path)

        self.assertEqual(metadata_store.document_registry[document_id]["status"], "completed")
        self.assertEqual(metadata_store.document_registry[document_id]["chunks"], 1)
        migrated = self.collection.get(where={"library_document_id": document_id})
        self.assertEqual(migrated["ids"], ["legacy-vector"])

    def test_rejects_removal_while_indexing(self) -> None:
        document = {
            "document_id": "active-document",
            "filename": "active.txt",
            "status": "processing",
            "chunks": None,
            "error": None,
            "uploaded_at": None,
            "file_path": "/data/active.txt",
            "size": 12,
        }
        metadata_store.persist_document(document, db_path=self.metadata_path)
        metadata_store.document_registry[document["document_id"]] = document

        with self.assertRaises(HTTPException) as context:
            routes_mod.delete_document(document["document_id"])

        self.assertEqual(context.exception.status_code, 409)

    def test_retries_failed_document_from_retained_original(self) -> None:
        document_id = "retry-document"
        file_path = Path(self.temporary_directory.name) / "retry.txt"
        file_path.write_text("retryable document")
        document = {
            "document_id": document_id,
            "filename": "retry.txt",
            "status": "failed",
            "chunks": 0,
            "error": "Previous indexing failed",
            "uploaded_at": None,
            "file_path": str(file_path),
            "size": file_path.stat().st_size,
        }
        metadata_store.persist_document(document, db_path=self.metadata_path)
        metadata_store.document_registry[document_id] = document

        with patch.object(routes_mod, "_ingest_document", new=AsyncMock()) as ingest:
            response = TestClient(main.app).post(f"/documents/{document_id}/retry")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "queued")
        self.assertIsNone(response.json()["error"])
        ingest.assert_awaited_once_with(document_id, str(file_path), "retry.txt")

    def test_retry_rejects_a_missing_original_without_changing_status(self) -> None:
        document_id = "missing-retry-document"
        document = {
            "document_id": document_id,
            "filename": "missing.txt",
            "status": "failed",
            "chunks": 0,
            "error": "Previous indexing failed",
            "uploaded_at": None,
            "file_path": str(Path(self.temporary_directory.name) / "missing.txt"),
            "size": 20,
        }
        metadata_store.persist_document(document, db_path=self.metadata_path)
        metadata_store.document_registry[document_id] = document

        response = TestClient(main.app).post(f"/documents/{document_id}/retry")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(metadata_store.document_registry[document_id]["status"], "failed")

    def test_scanned_pdf_error_explains_ocr_requirement(self) -> None:
        file_path = Path(self.temporary_directory.name) / "scanned.pdf"
        pdf = main.fitz.open()
        pdf.new_page()
        pdf.save(file_path)
        pdf.close()

        with self.assertRaisesRegex(ValueError, "OCR it before uploading"):
            main.parse_document(file_path)


if __name__ == "__main__":
    unittest.main()
