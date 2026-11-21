"""
Knowledge IQ — FastAPI Application Factory

Creates, configures, and registers routes for the Knowledge IQ backend.
Run with: uvicorn main:app --reload --host 127.0.0.1 --port 8000
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import routes
from app.core import config
from app.models.schemas import DocumentStatusResponse, UploadResponse
from app.services.metadata_store import restore_document_registry
from app.services.vector_store import chroma_collection, index_lock

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rag-backend")

app = FastAPI(title="Knowledge IQ — Local RAG Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Register API routes ----

app.get("/")(routes.root)
app.get("/health")(routes.health_check)

app.post("/upload", response_model=UploadResponse)(routes.upload_file)
app.post("/documents/upload", response_model=UploadResponse, include_in_schema=False)(
    routes.upload_file
)
app.post("/documents", response_model=UploadResponse)(routes.upload_file)

app.get("/documents")(routes.list_documents)
app.get("/documents/{document_id}/status", response_model=DocumentStatusResponse)(
    routes.document_status
)
app.delete("/documents/{document_id}")(routes.delete_document)
app.post("/documents/{document_id}/retry", response_model=DocumentStatusResponse)(
    routes.retry_document
)

app.post("/chat")(routes.chat)
app.post("/query")(routes.chat)

# ---- Startup: restore document registry from SQLite + ChromaDB ----

restore_document_registry(chroma_collection, index_lock=index_lock)
