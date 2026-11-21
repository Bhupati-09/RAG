# Knowledge IQ

**A local-first AI document assistant powered by retrieval-augmented generation (RAG).**

Knowledge IQ lets you add supported documents, index their content in a vector database, retrieve relevant passages, and ask questions using a locally hosted large language model through Ollama.

The goal is simple: make your own documents easier to search, understand, and use—without sending document content to a hosted AI service when the complete stack is run locally.

> **Project status:** Update this section as the project evolves. This repository documentation reflects the setup and capabilities described by the project author; verify commands and configuration against the current source before publishing a release.

## Contents

- [Highlights](#highlights)
- [How it works](#how-it-works)
- [Technology stack](#technology-stack)
- [Requirements](#requirements)
- [Run locally](#run-locally)
- [Supported document types](#supported-document-types)
- [Data and privacy](#data-and-privacy)
- [Validation](#validation)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

## Highlights

- **Document ingestion:** add supported files and extract their text locally.
- **Semantic retrieval:** create embeddings and store searchable vectors in ChromaDB.
- **Context-aware answers:** retrieve relevant document passages before generating an answer.
- **Local model inference:** use Ollama to run the language and embedding models on your machine.
- **Web interface:** interact with the assistant through a Next.js frontend.
- **Backend API:** use a FastAPI service to handle document and RAG operations.
- **Multilingual interface:** interface labels are available in English, Spanish, French, German, Brazilian Portuguese, Japanese, Telugu, Hindi, and Tamil.

## How it works

```text
                 ┌─────────────────────────┐
                 │      Next.js UI         │
                 │       (R/)              │
                 └────────────┬────────────┘
                              │ HTTP
                              ▼
                 ┌─────────────────────────┐
                 │      FastAPI            │
                 │  ingestion + RAG flow   │
                 └───────┬─────────┬───────┘
                         │         │
              embeddings │         │ generation
                         ▼         ▼
                 ┌────────────┐  ┌────────────┐
                 │ ChromaDB   │  │   Ollama   │
                 │ vector DB  │  │ llama3.2   │
                 └────────────┘  │ nomic-embed│
                                 └────────────┘
```

1. Add a document through the application.
2. The backend extracts its text and prepares it for indexing.
3. The embedding model converts text chunks into vectors.
4. ChromaDB stores the vectors and associated metadata.
5. When you ask a question, the backend retrieves relevant chunks.
6. The language model uses the retrieved context to generate an answer.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for more detail.

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | Next.js / React |
| Backend API | FastAPI |
| RAG orchestration | LlamaIndex |
| Vector database | ChromaDB |
| Local model runtime | Ollama |
| Language model | `llama3.2` |
| Embedding model | `nomic-embed-text` |

## Requirements

Install the following before starting:

- Python 3.11 or newer
- Node.js 20 or newer and npm
- Ollama
- Git

Pull the models used by the project:

```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

Confirm that Ollama is running:

```bash
ollama list
```

## Run locally

The commands below follow the setup shared for this project. They assume the FastAPI entry point is `main.py` in the project root and the frontend is in the `R/` directory. If your current folder layout differs, adjust the paths accordingly.

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd <YOUR_REPOSITORY_FOLDER>
```

### 2. Set up the Python backend

Create and activate a virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate
```

Install the backend dependencies:

```bash
pip install -r requirements.txt
```

Start the API:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The API should now be available at `http://127.0.0.1:8000`.

### 3. Set up the frontend

Open a second terminal:

```bash
cd R
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

If the repository contains a committed and current `package-lock.json`, use `npm ci` instead of `npm install` for a reproducible install.

### 4. Connect the frontend to the backend

In the application settings, configure the API URL as:

```text
http://localhost:8000
```

If the API URL is left blank, the interface may use its demo mode, as described in the original project setup.

### 5. Check the backend

Open:

```text
http://localhost:8000/health
```

A successful response should indicate that the backend is running. The exact response structure depends on the current implementation.

## Supported document types

The project setup currently describes support for:

- PDF
- DOCX
- TXT
- Markdown
- CSV
- JSON
- HTML

Text-based PDFs can be parsed locally. Scanned PDFs and image-only documents require OCR; OCR is not included in the described setup.

## Data and privacy

The current setup describes these local storage locations:

| Path | Purpose |
|---|---|
| `./chroma_db` | ChromaDB vector database |
| `./data` | Uploaded original documents |
| `./rag_metadata.sqlite3` | Document metadata |

Treat these directories as application data, not source code. They should not be committed to a public Git repository.

**Important privacy note:** “Local-first” depends on how the full application is configured and used. Keep the frontend, backend, Ollama, and storage in an environment you control if you require local processing. A browser can communicate with a non-local API if configured to do so.

The described application does not currently provide authentication, tenant isolation, managed encryption-at-rest, or a formal retention/deletion workflow. Do not expose the API publicly or upload confidential documents until suitable controls are implemented and tested.

## Validation

Run the checks available in the project:

```bash
# Backend tests
python -m unittest discover -s tests -v
```

Then, from the frontend directory:

```bash
cd R
npm run typecheck
npm run build
```

A check can only pass if the corresponding test suite or npm script exists in the current project. If a command is unavailable, inspect `package.json` and the `tests/` directory before adding or changing scripts.

## Troubleshooting

### The frontend cannot reach the backend

- Confirm that FastAPI is running.
- Check `http://localhost:8000/health`.
- Confirm the API URL in the frontend settings.
- Inspect the backend terminal for errors.

### Ollama is not responding

```bash
ollama list
ollama ps
```

Make sure the required models are installed and Ollama is running. To stop a loaded model:

```bash
ollama stop llama3.2
ollama stop nomic-embed-text
```

### A document does not appear in search

- Wait for document ingestion and indexing to finish.
- Check the backend terminal for parsing or embedding errors.
- Verify that the file type is supported.
- Remember that scanned/image-only PDFs need OCR.

### A model is missing

```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

## Known limitations

- OCR for scanned or image-only PDFs is not included in the described setup.
- Generated answers are not automatically translated just because a different interface language is selected.
- Authentication and authorization are not described as implemented.
- Production-grade monitoring, background job processing, and formal data-retention controls need additional work.

## Roadmap

Potential next steps:

- [ ] Add OCR support for scanned PDFs.
- [ ] Add answer citations that link back to source documents and page or chunk locations.
- [ ] Add authentication and per-user document access controls.
- [ ] Add document preview and page-level navigation.
- [ ] Add background ingestion jobs and progress reporting.
- [ ] Add structured logging and health checks for dependencies.
- [ ] Add evaluation datasets for retrieval relevance and answer quality.
- [ ] Add Docker-based development and deployment instructions.
- [ ] Add screenshots and a short product demo.

## Contributing

Contributions, bug reports, and thoughtful feature suggestions are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request.

## Security

Please do not report security vulnerabilities in public issues. See [`SECURITY.md`](SECURITY.md).

## License

No license has been selected for this repository yet. Add a `LICENSE` file before presenting the project as open source. Until then, the default copyright rules apply.
