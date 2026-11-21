"""RAG orchestration: querying, indexing, and Server-Sent Events streaming."""
import asyncio
import json
import logging
import re
import threading
from pathlib import Path
from typing import Any, AsyncGenerator

from fastapi import HTTPException
from llama_index.core import PromptTemplate, Settings, VectorStoreIndex
from llama_index.core.schema import NodeWithScore

from app.core import config
from app.models.schemas import ChatMessage, ChatRequest, MessagePart
from app.services.document_parser import parse_document
from app.services import metadata_store as _ms
from app.services.metadata_store import (
    persist_document,
    registry_lock,
)
from app.services.vector_store import (
    chroma_collection,
    index_lock,
    remove_document_vectors,
    storage_context,
    vector_store,
)

logger = logging.getLogger("rag-backend.rag")

QA_PROMPT = PromptTemplate(
    f"""{config.SYSTEM_PROMPT}

Use the following context to answer the user's question.
---------------------
{{context_str}}
---------------------
Question: {{query_str}}
If the context does not contain the answer, state:
"{config.NO_DOCUMENT_ANSWER}"
Answer the question directly in natural, professional Markdown. Organize details
with bullets only when useful. Use only the context above.
Answer:"""
)

REFINE_PROMPT = PromptTemplate(
    f"""{config.SYSTEM_PROMPT}

Question: {{query_str}}
Existing answer:
{{existing_answer}}

New context:
---------------------
{{context_msg}}
---------------------
Improve or refine the existing answer using the new context. Preserve useful
information only when supported by the combined document context. If that context
does not contain the answer, state:
"{config.NO_DOCUMENT_ANSWER}"
Refined answer:"""
)

query_engine_lock = threading.Lock()
query_index: Any | None = None
query_engines: dict[int, Any] = {}


def message_text(content: str | list[MessagePart]) -> str:
    if isinstance(content, str):
        return content
    return "".join(part.text or "" for part in content)


def extract_prompt(request: ChatRequest) -> str:
    if request.query and request.query.strip():
        return request.query
    if request.message and request.message.strip():
        return request.message
    if request.messages:
        for message in reversed(request.messages):
            if message.role == "user":
                prompt = message_text(message.content)
                if prompt.strip():
                    return prompt
        prompt = message_text(request.messages[-1].content)
        if prompt.strip():
            return prompt
    raise HTTPException(
        status_code=400,
        detail="No query provided. Send 'query', 'message', or 'messages'.",
    )


def is_conversational(prompt: str) -> bool:
    normalized = re.sub(r"[\W_]+", " ", prompt.lower()).strip()
    if any(keyword in prompt.lower() for keyword in config.DOCUMENT_QUERY_KEYWORDS):
        return False
    return len(normalized.split()) <= 2 and normalized in config.CONVERSATIONAL_INTENTS


def conversation_history(request: ChatRequest) -> list[tuple[str, str]]:
    if not request.messages:
        return []
    return [
        (message.role, message_text(message.content).strip())
        for message in request.messages[-8:]
        if message.role in {"user", "assistant"} and message_text(message.content).strip()
    ]


def sse_event(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


async def iterate_in_thread(iterable: Any) -> AsyncGenerator[Any, None]:
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[Any] = asyncio.Queue()
    stop = threading.Event()
    finished = object()

    def publish(item: Any) -> None:
        try:
            loop.call_soon_threadsafe(queue.put_nowait, item)
        except RuntimeError:
            stop.set()

    def produce() -> None:
        try:
            for item in iterable:
                if stop.is_set():
                    break
                publish(item)
        except Exception as exc:
            publish(exc)
        finally:
            publish(finished)

    threading.Thread(target=produce, daemon=True, name="rag-token-stream").start()
    try:
        while True:
            item = await queue.get()
            if item is finished:
                return
            if isinstance(item, Exception):
                raise item
            yield item
    finally:
        stop.set()


async def stream_response(response: Any) -> AsyncGenerator[str, None]:
    async for token in iterate_in_thread(response.response_gen):
        if token:
            yield str(token)


async def stream_completion(prompt: str) -> AsyncGenerator[str, None]:
    direct_prompt = (
        "You are a warm, professional, concise assistant. Respond naturally to the "
        "user without claiming access to documents or making unsupported claims.\n\n"
        f"User: {prompt}\nAssistant:"
    )
    response_stream = await asyncio.to_thread(Settings.llm.stream_complete, direct_prompt)
    async for response in iterate_in_thread(response_stream):
        if response.delta:
            yield response.delta


def get_query_engine(top_k: int) -> Any:
    global query_index
    with query_engine_lock:
        if query_index is None:
            query_index = VectorStoreIndex.from_vector_store(
                vector_store,
                storage_context=storage_context,
            )
        if top_k not in query_engines:
            query_engines[top_k] = query_index.as_query_engine(
                similarity_top_k=top_k,
                response_mode="compact",
                streaming=True,
                text_qa_template=QA_PROMPT,
                refine_template=REFINE_PROMPT,
            )
        return query_engines[top_k]


def update_document(doc_id: str, **changes: Any) -> None:
    with registry_lock:
        document = _ms.document_registry.get(doc_id)
        if document is None:
            raise KeyError(f"Document record not found: {doc_id}")
        document.update(changes)
        persist_document(document)


def index_document_sync(doc_id: str, file_path: str, filename: str) -> None:
    try:
        update_document(doc_id, status="processing")
        logger.info("Indexing document %s (%s)", doc_id, filename)
        documents = parse_document(Path(file_path))
        for document in documents:
            document.metadata.update(
                {
                    "library_document_id": doc_id,
                    "filename": filename,
                    "source": str(Path(file_path).resolve()),
                }
            )
            document.metadata.pop("document_id", None)

        with index_lock:
            VectorStoreIndex.from_documents(
                documents,
                storage_context=storage_context,
                show_progress=False,
                insert_batch_size=config.INDEX_INSERT_BATCH_SIZE,
            )
            chunk_count = len(
                chroma_collection.get(where={"library_document_id": doc_id})["ids"]
            )
        if chunk_count == 0:
            raise RuntimeError(f"Indexing {filename} completed without creating any ChromaDB chunks")
    except Exception as exc:
        logger.exception("Background indexing failed for %s: %s", filename, exc)
        error = exc.detail if isinstance(exc, HTTPException) else str(exc)
        try:
            with index_lock:
                remove_document_vectors(doc_id)
        except Exception as cleanup_error:
            logger.exception("Could not clean partial vectors for %s", filename)
            error = f"{error}; partial vectors could not be removed: {cleanup_error}"
        update_document(doc_id, status="failed", error=error)
        return

    update_document(doc_id, status="completed", chunks=chunk_count)
    logger.info("Indexing complete for %s — chunks: %d", filename, chunk_count)


def normalize_similarity_score(raw_score: float | None) -> float:
    """Normalize score to 0.0 - 1.0 range."""
    if raw_score is None:
        return 0.85
    # If distance is returned (e.g. squared L2 distance or cosine distance), convert to similarity
    if raw_score < 0:
        return 0.0
    if raw_score > 1.0:
        # Likely squared L2 distance: similarity = 1 / (1 + distance)
        return round(1.0 / (1.0 + raw_score), 3)
    return round(float(raw_score), 3)


async def stream_chat(
    prompt: str,
    history: list[tuple[str, str]] | None = None,
    top_k: int = 4,
) -> AsyncGenerator[str, None]:
    sources: list[dict[str, Any]] = []
    answer_parts: list[str] = []

    try:
        # 1. Quick intent check for simple conversational greetings
        if is_conversational(prompt):
            async for token in stream_completion(prompt):
                answer_parts.append(token)
                yield sse_event({"token": token})
            answer = "".join(answer_parts)
            metadata = {
                "answer": answer,
                "response": answer,
                "content": answer,
                "sources": [],
            }
            yield sse_event({"metadata": metadata})
            return

        # 2. Check knowledge base chunk availability
        chunk_count = await asyncio.to_thread(chroma_collection.count)
        if chunk_count == 0:
            answer_parts.append(config.NO_DOCUMENTS_MESSAGE)
            yield sse_event({"token": config.NO_DOCUMENTS_MESSAGE})
            answer = "".join(answer_parts)
            metadata = {
                "answer": answer,
                "response": answer,
                "content": answer,
                "sources": [],
            }
            yield sse_event({"metadata": metadata})
            return

        # 3. Retrieve chunks with pure semantic query
        # To avoid vector pollution, we query the vector store using the clean prompt.
        engine = get_query_engine(top_k)

        # If history exists, we contextualize synthesis while keeping retrieval focused
        def run_query() -> Any:
            if history:
                conversation_summary = "\n".join(
                    f"{'User' if r == 'user' else 'Assistant'}: {msg}"
                    for r, msg in history[-4:]
                )
                query_with_context = (
                    f"Relevant conversation context for reference:\n{conversation_summary}\n\n"
                    f"Current question: {prompt}"
                )
            else:
                query_with_context = prompt
            return engine.query(query_with_context)

        response = await asyncio.to_thread(run_query)
        source_nodes: list[NodeWithScore] = getattr(response, "source_nodes", [])

        for node in source_nodes:
            norm_score = normalize_similarity_score(node.score)
            page_num = node.node.metadata.get("page")
            filename = node.node.metadata.get("filename") or Path(
                str(node.node.metadata.get("source", ""))
            ).name
            doc_id = node.node.metadata.get("library_document_id") or ""
            logger.debug("Retrieved source %s (page %s) with score %s", filename, page_num, norm_score)
            sources.append(
                {
                    "text": node.node.text,
                    "source": str(node.node.metadata.get("source", "")),
                    "filename": filename,
                    "page": page_num,
                    "document_id": doc_id,
                    "score": norm_score,
                }
            )
        logger.info("Retrieved %d source passages", len(source_nodes))

        # Check relevance
        has_relevant_source = any(
            node.score is None or normalize_similarity_score(node.score) >= 0.25
            for node in source_nodes
        )
        if not source_nodes or not has_relevant_source:
            answer_parts.append(config.NO_DOCUMENT_ANSWER)
            yield sse_event({"token": config.NO_DOCUMENT_ANSWER})
        else:
            async for token in stream_response(response):
                answer_parts.append(token)
                yield sse_event({"token": token})

        answer = "".join(answer_parts)
        metadata = {
            "answer": answer,
            "response": answer,
            "content": answer,
            "sources": sources if has_relevant_source else [],
        }
        yield sse_event({"metadata": metadata})
    except Exception as exc:
        logger.exception("Chat retrieval/streaming failed: %s", exc)
        yield sse_event(
            {"error": "Chat stream failed. Check the backend terminal logs and try again."}
        )
    finally:
        yield "data: [DONE]\n\n"
