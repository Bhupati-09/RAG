# Knowledge IQ

Knowledge IQ is a local-first document assistant. It indexes supported files into
ChromaDB, retrieves relevant passages, and streams answers from a locally hosted
Ollama model.

## Requirements

- macOS, Linux, or Windows with Python 3.11+ and Node.js 20+
- Ollama installed and running
- The `llama3.2` and `nomic-embed-text` Ollama models

## Run locally

From the project root, create and activate the Python environment and install
the backend dependencies:

```bash
python3 -m venv venv
source venv/bin/activate
python -m pip install fastapi uvicorn chromadb httpx python-multipart pymupdf python-docx llama-index-core llama-index-llms-ollama llama-index-embeddings-ollama llama-index-vector-stores-chroma llama-index-readers-file
ollama pull llama3.2
ollama pull nomic-embed-text
```

Start the backend:

```bash
./venv/bin/uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

In another terminal:

```bash
cd R
npm ci
npm run dev
```

Open <http://localhost:3000>. In Settings, leave the API URL empty to explore
demo mode, or set it to `http://localhost:8000` to use the local backend. The
interface supports English, Spanish, French, German, Brazilian Portuguese,
Japanese, Telugu, Hindi, and Tamil. Select the interface language in Settings;
generated answers are not translated automatically.

## Validation

From the project root, run the backend lifecycle tests and frontend checks:

```bash
./venv/bin/python -m unittest discover -s tests -v
cd R
npm run typecheck
npm run build
```

The supported upload formats are PDF, DOCX, TXT, Markdown, CSV, JSON, and HTML.
Text-based PDFs are parsed locally; image-only/scanned PDFs require OCR, which is
not currently included.

## Local data and privacy

By default, ChromaDB writes to `./chroma_db`, uploaded originals are saved under
`./data`, and the persistent document library is stored in
`./rag_metadata.sqlite3`. Back up these locations together. Removing a document
from the library removes its vectors and metadata; the uploaded original remains
in `./data` so it can be re-indexed. Delete originals separately only when your
retention policy allows it. Failed indexing records show the backend error and
can be retried from the library while the original is still present. On startup,
existing ChromaDB metadata is migrated so document removal and retry target the
correct vectors.

The browser can be configured to call a non-local API URL. Do not describe a
deployment as local-only unless its frontend, backend, Ollama service, and storage
all run within the agreed environment. The app does not currently provide
authentication, tenant isolation, encryption-at-rest management, or a formal
retention/deletion workflow.

## Before a client or public deployment

- Review translated labels with native speakers and agree on terminology and
  answer style for the target client; locale formatting does not guarantee
  professional translation quality.
- Decide where documents may be processed and stored, and document retention,
  deletion, backup, and incident-response policies with the client.
- Add authentication and authorization before making the API reachable outside
  a trusted local network. `ALLOWED_ORIGINS` configures browser CORS; CORS is not
  authentication or a network firewall.
- Configure `ALLOWED_ORIGINS` as a comma-separated list of exact frontend
  origins for the deployment. The default allows only the local development
  frontend origins:

  ```bash
  ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
  ```

- Test representative client documents (including tables, columns, scanned
  pages, and non-English text) and verify citations before promising answer
  quality.
- Add a durable job queue and operational monitoring if indexing must resume
  automatically after a backend restart. Document records persist, but active
  indexing is not a durable background job.
- Agree on model quality, supported file sizes, latency targets, and the client
  hardware profile before deployment.

## Troubleshooting

- Check `GET http://localhost:8000/health` for backend, Ollama, and ChromaDB
  status.
- Use `ollama ps` to inspect loaded models and `ollama stop llama3.2` or
  `ollama stop nomic-embed-text` to unload them.
- Check the backend terminal for PDF parsing, indexing, ChromaDB, and retrieval
  errors. A document must finish indexing before it can ground answers.
