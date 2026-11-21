"""FastAPI route definitions for uploads, documents, chat, and health checks."""
import asyncio
import logging
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import BackgroundTasks, HTTPException, Request
from starlette.datastructures import UploadFile as StarletteUploadFile
from starlette.responses import StreamingResponse

from app.core import config
from app.models.schemas import ChatRequest, DocumentStatusResponse, UploadResponse
from app.services import metadata_store
from app.services.metadata_store import (
    persist_document,
    persist_documents,
    registry_lock,
)
from app.services.rag_service import (
    conversation_history,
    extract_prompt,
    stream_chat,
)
from app.services.vector_store import chroma_collection, index_lock

logger = logging.getLogger("rag-backend.routes")


def _save_upload(source: Any, destination: Path) -> int:
    """Write an uploaded file to disk, enforcing size limits."""
    size = 0
    with destination.open("wb") as target:
        while chunk := source.read(1024 * 1024):
            size += len(chunk)
            if size > config.MAX_UPLOAD_SIZE:
                raise ValueError(
                    f"File exceeds the {config.MAX_UPLOAD_SIZE // (1024 * 1024)} MB limit"
                )
            target.write(chunk)
    return size


async def _ingest_document(doc_id: str, file_path: str, filename: str) -> None:
    from app.services.rag_service import index_document_sync

    await asyncio.to_thread(index_document_sync, doc_id, file_path, filename)


async def _handle_uploads(
    files: list[StarletteUploadFile],
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    if not files:
        raise HTTPException(
            status_code=400,
            detail="No upload found. Use a multipart field named 'file', 'files', or 'document'.",
        )
    if len(files) > config.MAX_FILES_PER_UPLOAD:
        raise HTTPException(
            status_code=400,
            detail=f"A maximum of {config.MAX_FILES_PER_UPLOAD} files may be uploaded at once.",
        )

    prepared: list[tuple[StarletteUploadFile, str, str, str]] = []
    for upload in files:
        if not upload.filename:
            raise HTTPException(status_code=400, detail="Filename is required")

        safe_filename = Path(upload.filename.replace("\\", "/")).name
        extension = safe_filename.rsplit(".", 1)[-1].lower() if "." in safe_filename else ""
        if extension not in config.ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: .{extension}")
        doc_id = str(uuid.uuid4())
        prepared.append((upload, doc_id, safe_filename, f"{doc_id}_{safe_filename}"))

    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    saved_paths: list[Path] = []
    receipts: list[dict[str, str]] = []
    try:
        for upload, doc_id, safe_filename, stored_filename in prepared:
            file_path = config.UPLOAD_DIR / stored_filename
            saved_paths.append(file_path)
            size = await asyncio.to_thread(_save_upload, upload.file, file_path)
            if size == 0:
                raise HTTPException(status_code=400, detail=f"Empty file: {safe_filename}")
            receipts.append(
                {
                    "document_id": doc_id,
                    "status": "processing",
                    "message": f"Upload accepted. Indexing '{safe_filename}' in the background.",
                    "filename": safe_filename,
                }
            )
    except ValueError as exc:
        for saved_path in saved_paths:
            saved_path.unlink(missing_ok=True)
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except OSError as exc:
        for saved_path in saved_paths:
            saved_path.unlink(missing_ok=True)
        logger.exception("Could not save uploaded file")
        raise HTTPException(status_code=500, detail="Could not save uploaded file") from exc
    except HTTPException:
        for saved_path in saved_paths:
            saved_path.unlink(missing_ok=True)
        raise

    uploaded_at = datetime.now(timezone.utc).isoformat()
    records = [
        {
            "document_id": doc_id,
            "filename": safe_filename,
            "status": "queued",
            "chunks": None,
            "error": None,
            "uploaded_at": uploaded_at,
            "file_path": str(config.UPLOAD_DIR / stored_filename),
            "size": (config.UPLOAD_DIR / stored_filename).stat().st_size,
        }
        for _, doc_id, safe_filename, stored_filename in prepared
    ]
    try:
        with registry_lock:
            persist_documents(records)
            for document in records:
                document_registry[document["document_id"]] = document
        for document in records:
            background_tasks.add_task(
                _ingest_document,
                document["document_id"],
                document["file_path"],
                document["filename"],
            )
    except sqlite3.Error as exc:
        logger.exception("Could not persist uploaded document metadata")
        for saved_path in saved_paths:
            saved_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail="Could not save document metadata. Please retry the upload.",
        ) from exc

    response: dict[str, Any] = dict(receipts[0])
    if len(receipts) > 1:
        response["documents"] = receipts
    return response


# ---- Route handler functions (registered to app in app/main.py) ----


async def root() -> dict[str, str]:
    return {
        "status": "Online",
        "model": config.LLM_MODEL,
        "embedder": config.EMBED_MODEL,
    }


async def health_check() -> dict[str, Any]:
    result: dict[str, Any] = {
        "status": "ok",
        "backend": "live",
        "ollama": "unknown",
        "ollama_models": [],
        "chromadb": "unknown",
        "chromadb_chunks": 0,
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{config.OLLAMA_BASE_URL}/api/tags")
        if response.is_success:
            result["ollama"] = "connected"
            result["ollama_models"] = [
                model["name"] for model in response.json().get("models", [])
            ]
        else:
            result["ollama"] = f"error: HTTP {response.status_code}"
    except httpx.HTTPError as exc:
        result["ollama"] = f"unreachable: {exc}"

    try:
        result["chromadb_chunks"] = await asyncio.to_thread(chroma_collection.count)
        result["chromadb"] = "connected"
    except Exception as exc:
        logger.exception("ChromaDB health check failed")
        result["chromadb"] = f"error: {exc}"

    return result


async def upload_file(
    request: Request,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    try:
        form = await request.form(max_files=config.MAX_FILES_PER_UPLOAD, max_fields=100)
    except Exception as exc:
        logger.exception("Could not parse multipart upload request")
        raise HTTPException(status_code=400, detail="Invalid multipart upload request") from exc
    try:
        files = [
            value
            for key, value in form.multi_items()
            if key in config.UPLOAD_FIELD_NAMES and isinstance(value, StarletteUploadFile)
        ]
        return await _handle_uploads(files, background_tasks)
    finally:
        await form.close()


async def list_documents() -> dict[str, Any]:
    with registry_lock:
        documents = [
            {
                "document_id": document["document_id"],
                "filename": document["filename"],
                "status": document["status"],
                "chunks": document.get("chunks"),
                "error": document.get("error"),
                "uploaded_at": document.get("uploaded_at"),
                "size": document.get("size", 0),
            }
            for document in sorted(
                document_registry.values(),
                key=lambda record: record.get("uploaded_at") or "",
                reverse=True,
            )
        ]
    return {"documents": documents, "total": len(documents)}


async def document_status(document_id: str) -> DocumentStatusResponse:
    with registry_lock:
        document = document_registry.get(document_id)
        if document is None:
            raise HTTPException(status_code=404, detail="Document not found")
        return DocumentStatusResponse(
            document_id=document["document_id"],
            filename=document["filename"],
            status=document["status"],
            chunks=document.get("chunks"),
            error=document.get("error"),
            uploaded_at=document.get("uploaded_at"),
            size=document.get("size", 0),
        )


def delete_document(document_id: str) -> dict[str, str]:
    from app.services.metadata_store import metadata_connection
    from app.services.vector_store import remove_document_vectors

    with index_lock:
        with registry_lock:
            document = document_registry.get(document_id)
            if document is None:
                raise HTTPException(status_code=404, detail="Document not found")
            if document["status"] in {"queued", "processing"}:
                raise HTTPException(
                    status_code=409,
                    detail="Wait for indexing to finish before removing this document.",
                )

        try:
            remove_document_vectors(document_id)
            with metadata_connection() as connection:
                connection.execute(
                    "DELETE FROM documents WHERE document_id = ?",
                    (document_id,),
                )
        except Exception as exc:
            logger.exception(
                "Could not remove document %s from the knowledge base", document_id
            )
            raise HTTPException(
                status_code=500,
                detail="Could not remove the document from the knowledge base.",
            ) from exc

        with registry_lock:
            document_registry.pop(document_id, None)

    return {"status": "removed", "document_id": document_id}


def retry_document(
    document_id: str, background_tasks: BackgroundTasks
) -> DocumentStatusResponse:
    with registry_lock:
        document = document_registry.get(document_id)
        if document is None:
            raise HTTPException(status_code=404, detail="Document not found")
        if document["status"] != "failed":
            raise HTTPException(
                status_code=409,
                detail="Only failed documents can be retried.",
            )
        file_path = Path(document["file_path"])
        if not file_path.is_file():
            raise HTTPException(
                status_code=404,
                detail="The uploaded original is missing. Upload the file again to retry.",
            )
        document.update(status="queued", chunks=None, error=None)
        persist_document(document)
        filename = str(document["filename"])
        path = str(file_path)

    background_tasks.add_task(_ingest_document, document_id, path, filename)
    return DocumentStatusResponse(
        document_id=document_id,
        filename=filename,
        status="queued",
        chunks=None,
        error=None,
        uploaded_at=document.get("uploaded_at"),
        size=document.get("size", 0),
    )


async def chat(request: ChatRequest) -> StreamingResponse:
    prompt = extract_prompt(request).strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Empty query")
    return StreamingResponse(
        stream_chat(prompt, conversation_history(request), request.top_k),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
