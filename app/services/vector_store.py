"""ChromaDB vector store and LlamaIndex model settings initialization."""
import logging
import threading
from typing import Any

import chromadb
from llama_index.core import Settings, StorageContext
from llama_index.core.node_parser import SentenceSplitter
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.llms.ollama import Ollama
from llama_index.vector_stores.chroma import ChromaVectorStore

from app.core import config

logger = logging.getLogger("rag-backend.vector-store")

# LlamaIndex Global Settings
Settings.llm = Ollama(
    model=config.LLM_MODEL,
    request_timeout=config.OLLAMA_TIMEOUT,
    context_window=config.OLLAMA_NUM_CTX,
    additional_kwargs={
        "num_ctx": config.OLLAMA_NUM_CTX,
        "num_predict": config.OLLAMA_NUM_PREDICT,
    },
    keep_alive=config.OLLAMA_KEEP_ALIVE,
    base_url=config.OLLAMA_BASE_URL,
)

Settings.embed_model = OllamaEmbedding(
    model_name=config.EMBED_MODEL,
    base_url=config.OLLAMA_BASE_URL,
    client_kwargs={"timeout": config.OLLAMA_TIMEOUT},
    ollama_additional_kwargs={"num_ctx": config.OLLAMA_NUM_CTX},
    keep_alive=config.OLLAMA_KEEP_ALIVE,
)

Settings.node_parser = SentenceSplitter(
    chunk_size=config.RAG_CHUNK_SIZE,
    chunk_overlap=config.RAG_CHUNK_OVERLAP,
)

# Persistent ChromaDB client and collection
chroma_client = chromadb.PersistentClient(path=config.CHROMA_DB_PATH)
chroma_collection = chroma_client.get_or_create_collection("rag_collection")
vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
storage_context = StorageContext.from_defaults(vector_store=vector_store)

index_lock = threading.Lock()


def remove_document_vectors(doc_id: str) -> None:
    """Delete all indexed chunks associated with a specific document ID."""
    chroma_collection.delete(where={"library_document_id": doc_id})


def count_vectors() -> int:
    """Return total number of vector chunks stored in ChromaDB."""
    return chroma_collection.count()
