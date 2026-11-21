# Knowledge IQ — Architecture

## Overview

Knowledge IQ follows a retrieval-augmented generation (RAG) workflow. The frontend sends user actions to a FastAPI backend. The backend coordinates document extraction, embeddings, vector retrieval, and response generation.

## Main components

| Component | Responsibility |
|---|---|
| Next.js / React frontend | User interface, document interactions, chat experience, and API configuration |
| FastAPI | Backend entry point and orchestration of ingestion and question-answering operations |
| LlamaIndex | RAG components and integrations |
| Ollama | Local model runtime |
| `nomic-embed-text` | Embedding model used to represent text as vectors |
| `llama3.2` | Language model used to generate responses |
| ChromaDB | Vector storage and similarity retrieval |

## Ingestion flow

```text
Document
   |
   v
File validation
   |
   v
Text extraction
   |
   v
Chunking
   |
   v
Embedding model (Ollama)
   |
   v
ChromaDB + document metadata
```

## Question-answering flow

```text
User question
   |
   v
FastAPI backend
   |
   v
Embed question
   |
   v
Retrieve relevant chunks from ChromaDB
   |
   v
Build context for the language model
   |
   v
Ollama language model
   |
   v
Answer returned to the frontend
```

## Local data locations

The project setup currently describes:

- `./chroma_db` — vector database files.
- `./data` — uploaded source documents.
- `./rag_metadata.sqlite3` — document metadata.

These are runtime data locations. Keep them out of version control and back them up according to the needs of your use case.

## Trust boundaries and deployment notes

- A local Ollama instance does not make the entire application local if the frontend is configured to call a remote API.
- CORS controls which browser origins may read responses; it does not authenticate clients.
- Before public deployment, add authentication, authorization, request-size limits, upload validation, rate limiting, secure transport, and a documented data-retention policy.
- Avoid logging full document text, prompts containing sensitive data, or credentials.
- Validate retrieval quality and answer grounding with a representative evaluation set before relying on the system for important decisions.

## Implementation details to verify

Before publishing this architecture as a precise implementation specification, confirm the current source code for:

- Chunk size and overlap.
- Similarity metric and retrieval top-k.
- Metadata schema and document identity strategy.
- Whether answers include source citations.
- Whether chat history is persisted.
- Whether ingestion is synchronous or backgrounded.
- Exact API route names and request/response schemas.
