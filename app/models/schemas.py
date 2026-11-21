"""Pydantic schemas for API requests and responses."""
from typing import Any
from pydantic import BaseModel, Field


class MessagePart(BaseModel):
    text: str | None = None


class ChatMessage(BaseModel):
    role: str = "user"
    content: str | list[MessagePart]


class ChatRequest(BaseModel):
    query: str | None = None
    message: str | None = None
    messages: list[ChatMessage] | None = None
    top_k: int = Field(default=4, ge=1, le=10)


class UploadReceipt(BaseModel):
    document_id: str
    status: str
    message: str
    filename: str


class UploadResponse(UploadReceipt):
    documents: list[UploadReceipt] | None = None


class DocumentStatusResponse(BaseModel):
    document_id: str
    filename: str
    status: str
    chunks: int | None = None
    error: str | None = None
    uploaded_at: str | None = None
    size: int | None = None


class HealthResponse(BaseModel):
    status: str
    backend: str
    ollama: str
    ollama_models: list[str]
    chromadb: str
    chromadb_chunks: int
