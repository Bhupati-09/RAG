# 🧠 Knowledge IQ
### Your Documents. Your Knowledge. Your AI Assistant.

Knowledge IQ is a **local-first, AI-powered document intelligence platform** built using Retrieval-Augmented Generation (RAG). It allows users to upload documents, retrieve relevant information through semantic search, and interact with their knowledge base using a locally hosted Large Language Model (LLM).

Powered by **Ollama, ChromaDB, LlamaIndex, and FastAPI**, Knowledge IQ transforms static documents into an interactive knowledge assistant while providing greater control over data processing and storage.

---

## ✨ Key Features

- **Multi-Format Document Support:** Upload PDF, DOCX, TXT, Markdown, CSV, JSON, and HTML files.
- **Intelligent Document Processing:** Extract and process document content for efficient retrieval.
- **Semantic Search:** Retrieve relevant document passages using vector embeddings and similarity search.
- **Retrieval-Augmented Generation (RAG):** Generate context-aware answers grounded in retrieved document content.
- **Local LLM Integration:** Run AI models locally through Ollama without depending on hosted LLM APIs.
- **Persistent Knowledge Base:** Store document metadata and vector embeddings for subsequent queries.
- **Streaming Responses:** Receive generated answers incrementally rather than waiting for the entire response.
- **Multilingual Interface:** Supports English, Spanish, French, German, Brazilian Portuguese, Japanese, Telugu, Hindi, and Tamil.
- **Interactive Dashboard:** Upload documents, manage your knowledge base, and interact with your AI assistant.

## 🏗️ System Architecture

Knowledge IQ follows a Retrieval-Augmented Generation architecture that connects document ingestion, embedding generation, vector retrieval, and LLM-based response generation.

```text
                 USER
                   |
                   v
          Next.js Frontend
             (Port 3000)
                   |
                   v
             FastAPI Backend
             (Port 8000)
                   |
          +--------+--------+
          |                 |
          v                 v
    Document Upload     User Query
          |                 |
          v                 v
    Text Extraction    Query Embedding
          |                 |
          v                 v
    Text Chunking      ChromaDB Search
          |                 |
          v                 v
    Embedding Model    Relevant Chunks
          |                 |
          v                 |
       ChromaDB <-----------+
          |
          v
    Retrieved Context
          |
          v
    LlamaIndex + Ollama
          |
          v
    Llama 3.2 LLM
          |
          v
    Generated Answer
          |
          v
    Next.js Frontend
```

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Backend | Python, FastAPI |
| RAG Framework | LlamaIndex |
| Large Language Model | Llama 3.2 |
| Embedding Model | nomic-embed-text |
| Vector Database | ChromaDB |
| Local Model Runtime | Ollama |
| Document Processing | PyMuPDF, python-docx |
| Metadata Storage | SQLite |
| API Communication | HTTP / REST |

## ⚙️ Prerequisites

Before running the application, ensure you have the following installed:

- Python 3.11 or later
- Node.js 20 or later
- npm
- Ollama
- Git

### Required Ollama Models

Pull the models required by the application:

```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

Ensure Ollama is running before starting the application.

## 🚀 Getting Started

Follow these steps to run Knowledge IQ locally.

### 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd knowledge-intelligence-dashboard
```

### 2. Set Up the Backend

Create a Python virtual environment:

```bash
python3 -m venv venv
```

Activate it:

**macOS / Linux**

```bash
source venv/bin/activate
```

**Windows**

```bash
venv\Scripts\activate
```

Install the required dependencies:

```bash
python -m pip install fastapi uvicorn chromadb httpx python-multipart pymupdf python-docx llama-index-core llama-index-llms-ollama llama-index-embeddings-ollama llama-index-vector-stores-chroma llama-index-readers-file
```

### 3. Download the AI Models

```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

### 4. Start the Backend Server

From the backend directory (or the directory containing `main.py`):

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The backend will be available at:

```text
http://localhost:8000
```

API health check:

```text
http://localhost:8000/health
```

### 5. Set Up the Frontend

Open another terminal:

```bash
cd R
npm ci
npm run dev
```

The frontend will be available at:

```text
http://localhost:3000
```

Open the application in your browser.

### 6. Configure the Application

Navigate to **Settings** in the application.

- Leave the API URL empty to explore demo mode.
- Set the API URL to `http://localhost:8000` to connect to the local backend.

---

## 📂 Supported Document Formats

| Format | Extension | Support |
|---|---|---|
| PDF | `.pdf` | Supported |
| Word | `.docx` | Supported |
| Text | `.txt` | Supported |
| Markdown | `.md` | Supported |
| CSV | `.csv` | Supported |
| JSON | `.json` | Supported |
| HTML | `.html` | Supported |

**Note:** Text-based PDFs are processed locally. Image-only or scanned PDFs currently require OCR, which is not included in this version.

## 🔌 API Overview

The FastAPI backend exposes endpoints for interacting with the document intelligence system.

The main application workflows include:

- Document uploading and ingestion.
- Document library management.
- Semantic retrieval.
- Context-aware question answering.
- Streaming chat responses.
- Backend health monitoring.

Interactive API documentation is available through FastAPI's Swagger UI, if enabled:

```text
http://localhost:8000/docs
```

For exact endpoint paths and request formats, refer to the backend implementation.

## 🧪 Validation and Testing

Run the backend lifecycle tests:

```bash
./venv/bin/python -m unittest discover -s tests -v
```

Validate the frontend types:

```bash
cd R
npm run typecheck
```

Build the production frontend:

```bash
npm run build
```

These checks help identify backend test failures, TypeScript errors, and frontend build issues.

## 🔐 Data Storage and Privacy

Knowledge IQ uses local storage by default.

| Component | Default Location |
|---|---|
| Vector Database | `./chroma_db` |
| Uploaded Documents | `./data/` |
| Document Metadata | `./rag_metadata.sqlite3` |

**Important considerations:**

- Uploaded documents and their associated vector representations are stored locally by default.
- Removing a document from the library removes its vectors and metadata.
- The original uploaded file remains in the `./data/` directory and can be re-indexed.
- Back up the vector database, uploaded documents, and metadata database together.
- The application does not currently provide authentication, tenant isolation, encryption-at-rest management, or a formal retention/deletion workflow.

The frontend can also be configured to communicate with a non-local backend. Therefore, local-first operation should not be confused with a guarantee that every deployment is entirely local.

## ⚠️ Production Deployment Considerations

Before deploying Knowledge IQ for clients or exposing it publicly, consider the following:

1. **Authentication and Authorization:** Implement secure user authentication and access controls.
2. **CORS Configuration:** Configure `ALLOWED_ORIGINS` with the exact frontend origins permitted to access the API. CORS is not an authentication mechanism.
3. **Document Security:** Define document storage, backup, retention, and deletion policies.
4. **OCR Integration:** Add OCR support for scanned and image-based documents.
5. **RAG Evaluation:** Test retrieval relevance, answer accuracy, and citation correctness.
6. **Background Processing:** Implement durable background jobs for long-running document indexing.
7. **Monitoring:** Track API availability, indexing failures, retrieval latency, and model performance.
8. **Scalability:** Evaluate hardware requirements, supported document sizes, and concurrent users.

For example, the default local frontend origins can be configured using:

```bash
ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
```

Review the actual backend configuration before applying environment variables in production.

## 🔧 Troubleshooting

| Issue | Suggested Solution |
|---|---|
| Backend not responding | Check whether FastAPI is running on port 8000. |
| Ollama connection failure | Ensure the Ollama service is running. |
| Model not found | Run `ollama pull llama3.2` and `ollama pull nomic-embed-text`. |
| Document not appearing in search | Confirm that document indexing has completed. |
| ChromaDB errors | Inspect the backend terminal and verify local storage permissions. |
| Frontend cannot connect | Verify the API URL in Settings. |
| High memory usage | Use `ollama ps` to inspect loaded models. |

To unload a model:

```bash
ollama stop llama3.2
ollama stop nomic-embed-text
```

## 🗺️ Future Improvements

Potential enhancements for future versions include:

- OCR support for scanned documents.
- Improved document chunking and retrieval strategies.
- Hybrid search combining semantic and keyword retrieval.
- Reranking for improved retrieval relevance.
- Source citations and document-level traceability.
- Authentication and multi-user support.
- Automated RAG evaluation and performance monitoring.
- Docker-based deployment.
- Cloud deployment with scalable storage and model-serving infrastructure.

## 🎯 Project Objective

The objective of Knowledge IQ is to demonstrate how Retrieval-Augmented Generation can transform traditional document repositories into intelligent, searchable knowledge systems.

By combining local LLM inference, vector databases, semantic retrieval, and modern web technologies, the project explores a practical approach to building privacy-conscious AI applications.

---

**Built with ❤️ using Python, FastAPI, Next.js, LlamaIndex, ChromaDB, and Ollama.**