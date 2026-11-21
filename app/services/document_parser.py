"""Document text extraction service supporting PDF, DOCX, TXT, MD, and more."""
import logging
from pathlib import Path

# Use pymupdf directly to prevent deprecation warning while retaining fitz alias
try:
    import pymupdf as fitz
except ImportError:
    import fitz  # type: ignore

import docx
from llama_index.core import SimpleDirectoryReader
from llama_index.core.schema import Document

logger = logging.getLogger("rag-backend.parser")


def parse_document(file_path: Path) -> list[Document]:
    """
    Extract readable text chunks from a supported file format.
    Attaches page numbers and source metadata.
    Raises ValueError if no readable text is found (e.g. scanned PDFs requiring OCR).
    """
    extension = file_path.suffix.lower()
    source = str(file_path.resolve())
    filename = file_path.name
    documents: list[Document] = []

    if extension == ".pdf":
        with fitz.open(file_path) as pdf:
            for page_index, page in enumerate(pdf):
                text = page.get_text("text")
                if not text.strip():
                    logger.warning("Skipping empty PDF page %d in %s", page_index + 1, file_path)
                    continue
                documents.append(
                    Document(
                        text=text.strip(),
                        metadata={
                            "page": page_index + 1,
                            "source": source,
                            "filename": filename,
                        },
                    )
                )
    elif extension == ".docx":
        word_document = docx.Document(str(file_path))
        text = "\n".join(paragraph.text for paragraph in word_document.paragraphs).strip()
        if text:
            documents.append(
                Document(
                    text=text,
                    metadata={"source": source, "filename": filename, "page": 1},
                )
            )
    elif extension in {".txt", ".md"}:
        text = file_path.read_text(encoding="utf-8", errors="replace").strip()
        if text:
            documents.append(
                Document(
                    text=text,
                    metadata={"source": source, "filename": filename, "page": 1},
                )
            )
    else:
        documents = SimpleDirectoryReader(input_files=[str(file_path)]).load_data()
        for doc in documents:
            doc.metadata["source"] = source
            doc.metadata["filename"] = filename
            if "page" not in doc.metadata:
                doc.metadata["page"] = 1

    if not documents:
        if extension == ".pdf":
            raise ValueError(
                f"No readable text was found in {file_path.name}. "
                "If it is scanned or image-only, OCR it before uploading."
            )
        raise ValueError(f"No readable text could be extracted from {file_path.name}")

    return documents
