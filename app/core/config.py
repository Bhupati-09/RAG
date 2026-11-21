"""Application configuration and constants."""
import os
from pathlib import Path

# Ollama inference configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
LLM_MODEL = os.getenv("LLM_MODEL", "llama3.2")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "120.0"))
OLLAMA_KEEP_ALIVE = os.getenv("OLLAMA_KEEP_ALIVE", "2m")
OLLAMA_NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "2048"))
OLLAMA_NUM_PREDICT = int(os.getenv("OLLAMA_NUM_PREDICT", "512"))

# RAG chunking parameters
# 512 tokens with 64 overlap provides balanced semantic cohesion for research papers and reports
RAG_CHUNK_SIZE = int(os.getenv("RAG_CHUNK_SIZE", "512"))
RAG_CHUNK_OVERLAP = int(os.getenv("RAG_CHUNK_OVERLAP", "64"))
INDEX_INSERT_BATCH_SIZE = int(os.getenv("INDEX_INSERT_BATCH_SIZE", "64"))
DEFAULT_TOP_K = int(os.getenv("RAG_DEFAULT_TOP_K", "4"))

# Local storage paths
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./data"))
CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_db")
METADATA_DB_PATH = Path(os.getenv("METADATA_DB_PATH", "./rag_metadata.sqlite3"))

# Upload constraints
MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE_MB", "25")) * 1024 * 1024
MAX_FILES_PER_UPLOAD = int(os.getenv("MAX_FILES_PER_UPLOAD", "10"))
UPLOAD_FIELD_NAMES = {"file", "files", "document"}
ALLOWED_EXTENSIONS = {"pdf", "md", "txt", "docx", "csv", "json", "html"}

# Standard responses and prompt guardrails
NO_DOCUMENT_ANSWER = "I cannot find that information in the uploaded document."
MISSING_INDEXED_VECTORS_ERROR = "Indexed vectors are missing. Upload the document again."
NO_DOCUMENTS_MESSAGE = "Please upload a document first."

CONVERSATIONAL_INTENTS = {
    "hi",
    "hello",
    "hey",
    "thanks",
    "thank you",
    "who are you",
    "how are you",
}

DOCUMENT_QUERY_KEYWORDS = (
    "pdf",
    "document",
    "attached",
    "upload",
    "file",
    "what does it",
    "summarize",
    "tell me about",
)

SYSTEM_PROMPT = f"""You are a professional, approachable document assistant.
Answer the user's current question using ONLY the retrieved document context below,
NOT prior knowledge. Use recent conversation only to understand references and
follow-up questions; it is not evidence and cannot add facts.

Write like a helpful human colleague: answer the question directly, use clear and
natural language, and avoid canned openings, repetitive conclusions, or robotic
phrasing. Use Markdown headings, bullets, or numbered steps only when they make
the answer easier to scan; do not force a heading for a simple answer.

Be precise about what the document says. Do not invent facts, quotes, page numbers,
or citations. Distinguish document statements from interpretation. If the retrieved
context does not support an answer, say: "{NO_DOCUMENT_ANSWER}"
Keep the answer focused and concise unless the user asks for detail."""

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]
