"""
Knowledge IQ — Entry Point

Backward-compatible proxy that re-exports the FastAPI application from the
modularized ``app`` package. All existing commands continue to work:

    uvicorn main:app --reload --host 127.0.0.1 --port 8000

The actual implementation lives under ``app/``:
    app/core/config.py      — Configuration and constants
    app/models/schemas.py   — Pydantic request/response schemas
    app/services/           — Document parsing, vector store, metadata, RAG
    app/api/routes.py       — Route handler functions
    app/main.py             — Application factory and route registration
"""

from app.main import app  # noqa: F401

# Re-export key symbols used by the test suite
from app.core.config import MISSING_INDEXED_VECTORS_ERROR  # noqa: F401
from app.services.document_parser import parse_document  # noqa: F401
from app.services.metadata_store import (  # noqa: F401
    document_registry,
    persist_document,
    registry_lock,
    restore_document_registry as _restore_document_registry,
)
from app.services.vector_store import (  # noqa: F401
    chroma_collection,
    index_lock,
    remove_document_vectors as _remove_document_vectors,
)
from app.api.routes import delete_document  # noqa: F401

# Re-export fitz for the scanned-PDF test
try:
    import pymupdf as fitz  # noqa: F401
except ImportError:
    import fitz  # type: ignore  # noqa: F401
