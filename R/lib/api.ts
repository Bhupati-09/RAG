import type { ChatMessage, KnowledgeDocument, SourceCitation } from './types'

export interface HealthResult {
  connected: boolean
  mode: 'live' | 'demo'
  latencyMs: number
  ollama?: string
  chromadb?: string
}

export interface QueryResult {
  answer: string
  sources: SourceCitation[]
}

interface BackendDocument {
  document_id: string
  filename: string
  status: string
  chunks?: number | null
  error?: string | null
  uploaded_at?: string | null
  size?: number
}

export class DocumentUploadError extends Error {
  constructor(message: string, readonly documentId?: string) {
    super(message)
    this.name = 'DocumentUploadError'
  }
}

export type UploadStage = 'uploading' | 'indexing'
export type UploadProgress = (progress: number, stage: UploadStage) => void

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const trimSlash = (url: string) => url.replace(/\/+$/, '')

function mapBackendDocument(document: BackendDocument): KnowledgeDocument {
  const uploadedAt = document.uploaded_at ? Date.parse(document.uploaded_at) : 0
  const status =
    document.status === 'completed'
      ? 'ready'
      : document.status === 'failed'
        ? 'error'
        : document.status === 'queued' || document.status === 'processing'
          ? 'indexing'
          : null
  if (!status) throw new Error(`Backend returned an unknown document status: ${document.status}`)

  return {
    id: document.document_id,
    name: document.filename,
    size: typeof document.size === 'number' ? document.size : 0,
    type: document.filename.split('.').pop()?.toLowerCase() || 'file',
    status,
    progress: status === 'ready' ? 100 : 0,
    chunks: typeof document.chunks === 'number' ? document.chunks : undefined,
    uploadedAt: Number.isFinite(uploadedAt) ? uploadedAt : 0,
    error: document.error ?? undefined,
  }
}

function isBackendDocument(value: unknown): value is BackendDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const document = value as Record<string, unknown>
  return (
    typeof document.document_id === 'string' &&
    typeof document.filename === 'string' &&
    typeof document.status === 'string' &&
    (document.chunks === undefined || document.chunks === null || typeof document.chunks === 'number') &&
    (document.error === undefined || document.error === null || typeof document.error === 'string') &&
    (document.uploaded_at === undefined ||
      document.uploaded_at === null ||
      typeof document.uploaded_at === 'string') &&
    (document.size === undefined || typeof document.size === 'number')
  )
}

export async function listDocuments(apiUrl: string): Promise<KnowledgeDocument[]> {
  const res = await fetch(`${trimSlash(apiUrl)}/documents`)
  if (!res.ok) throw new Error(`Could not load documents (${res.status})`)
  const data: unknown = await res.json()
  if (!data || typeof data !== 'object' || !('documents' in data) || !Array.isArray(data.documents)) {
    throw new Error('Backend returned an invalid document list')
  }
  return data.documents.map((document: unknown) => {
    if (!isBackendDocument(document)) {
      throw new Error('Backend returned an invalid document record')
    }
    return mapBackendDocument(document)
  })
}

export async function deleteKnowledgeDocument(apiUrl: string, documentId: string): Promise<void> {
  const res = await fetch(`${trimSlash(apiUrl)}/documents/${encodeURIComponent(documentId)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body: unknown = await res.json()
      if (body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string') {
        detail = body.detail
      }
    } catch {
      detail = res.statusText
    }
    throw new Error(`Could not remove document (${res.status}): ${detail}`)
  }
}

/**
 * When no API URL is configured, the client runs in demo mode with a local
 * simulated RAG backend so the UI is fully explorable without a server.
 */
export async function checkHealth(apiUrl: string): Promise<HealthResult> {
  const started = performance.now()
  if (!apiUrl) {
    await sleep(250)
    return { connected: true, mode: 'demo', latencyMs: Math.round(performance.now() - started) }
  }
  const res = await fetch(`${trimSlash(apiUrl)}/health`, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`Health check failed (${res.status})`)
  const data = await res.json()
  return {
    connected: true,
    mode: 'live',
    latencyMs: Math.round(performance.now() - started),
    ollama: data.ollama,
    chromadb: data.chromadb,
  }
}

export async function queryKnowledge(
  apiUrl: string,
  question: string,
  topK: number,
  documents: KnowledgeDocument[],
  onToken: (token: string) => void,
  history: Pick<ChatMessage, 'role' | 'content'>[] = [],
): Promise<QueryResult> {
  if (apiUrl) {
    const res = await fetch(`${trimSlash(apiUrl)}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // 'query' matches the FastAPI ChatRequest schema field name
      body: JSON.stringify({
        query: question,
        top_k: topK,
        messages: history.map(({ role, content }) => ({ role, content })),
      }),
      signal: AbortSignal.timeout(5 * 60 * 1000),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText)
      throw new Error(`Query failed (${res.status}): ${detail}`)
    }
    if (!res.body) throw new Error('Query response did not include a readable stream')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let answer = ''
    let rawSources: unknown[] = []
    let metadataAnswer: string | null = null
    let receivedDone = false

    const processFrame = (frame: string) => {
      const data = frame
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n')
      if (!data) return
      if (data === '[DONE]') {
        receivedDone = true
        return
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(data)
      } catch {
        throw new Error('Received malformed data from the chat stream')
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Received an invalid event from the chat stream')
      }
      const event = parsed as Record<string, unknown>

      if (typeof event.token === 'string') {
        answer += event.token
        onToken(event.token)
      } else if (event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)) {
        const metadata = event.metadata as Record<string, unknown>
        metadataAnswer =
          typeof metadata.answer === 'string'
            ? metadata.answer
            : typeof metadata.response === 'string'
              ? metadata.response
              : typeof metadata.content === 'string'
                ? metadata.content
                : null
        rawSources = Array.isArray(metadata.sources) ? metadata.sources : []
      } else if (typeof event.error === 'string') {
        throw new Error(event.error)
      }
    }

    try {
      while (true) {
        let result: ReadableStreamReadResult<Uint8Array>
        try {
          result = await reader.read()
        } catch {
          throw new Error('The chat stream disconnected before completing. Please try again.')
        }
        const { done, value } = result
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split(/\r?\n\r?\n/)
        buffer = frames.pop() ?? ''
        for (const frame of frames) {
          processFrame(frame)
          if (receivedDone) break
        }
        if (receivedDone) break
      }
      buffer += decoder.decode()
      if (buffer.trim() && !receivedDone) processFrame(buffer)
    } finally {
      reader.releaseLock()
    }

    if (!receivedDone) {
      throw new Error('The chat stream disconnected before completing. Please try again.')
    }
    if (metadataAnswer === null) {
      throw new Error('The chat stream ended without response metadata. Please try again.')
    }
    const sources: SourceCitation[] = rawSources.map((source, i) => {
      if (source && typeof source === 'object' && !Array.isArray(source)) {
        const citation = source as Record<string, unknown>
        const sourcePath = typeof citation.source === 'string' ? citation.source : ''
        const filename =
          typeof citation.filename === 'string' && citation.filename
            ? citation.filename
            : sourcePath.split(/[\\/]/).pop() || `Source ${i + 1}`
        const page = typeof citation.page === 'number' && citation.page > 0 ? citation.page : undefined
        const rawScore = typeof citation.score === 'number' ? citation.score : 1 - i * 0.05
        const score = Math.max(0, Math.min(1, rawScore))
        const docId = typeof citation.document_id === 'string' ? citation.document_id : `src-${i}`
        return {
          documentId: docId,
          documentName: filename,
          snippet: typeof citation.text === 'string' ? citation.text : '',
          score,
          page,
        }
      }
      return {
        documentId: `src-${i}`,
        documentName: `Source ${i + 1}`,
        snippet: typeof source === 'string' ? source : JSON.stringify(source),
        score: 1 - i * 0.05,
      }
    })
    return { answer: metadataAnswer ?? answer, sources }
  }
  const result = await mockQuery(question, topK, documents)
  for (let i = 0; i < result.answer.length; i += 24) {
    onToken(result.answer.slice(i, i + 24))
    await sleep(18)
  }
  return result
}

async function responseError(response: Response): Promise<string> {
  const body = await response.text()
  try {
    const parsed: unknown = JSON.parse(body)
    if (parsed && typeof parsed === 'object' && 'detail' in parsed && typeof parsed.detail === 'string') {
      return parsed.detail
    }
  } catch {
    return body || response.statusText
  }
  return body || response.statusText
}

async function waitForDocumentIndexing(
  apiUrl: string,
  documentId: string,
  onProgress: UploadProgress,
): Promise<number> {
  const startedAt = Date.now()
  let delayMs = 1500
  let consecutiveFailures = 0
  onProgress(100, 'indexing')

  while (Date.now() - startedAt < 5 * 60 * 1000) {
    await sleep(delayMs)
    let response: Response
    try {
      response = await fetch(
        `${trimSlash(apiUrl)}/documents/${encodeURIComponent(documentId)}/status`,
        { signal: AbortSignal.timeout(10000) },
      )
    } catch (error) {
      consecutiveFailures += 1
      if (consecutiveFailures >= 4) {
        const detail = error instanceof Error ? error.message : 'network error'
        throw new DocumentUploadError(`Could not check indexing status: ${detail}`, documentId)
      }
      delayMs = Math.min(delayMs * 2, 6000)
      continue
    }

    if (response.status === 404) {
      throw new DocumentUploadError('The backend no longer has this upload record.', documentId)
    }
    if (!response.ok) {
      const detail = await responseError(response)
      consecutiveFailures += 1
      if (response.status >= 500 && consecutiveFailures < 4) {
        delayMs = Math.min(delayMs * 2, 6000)
        continue
      }
      throw new DocumentUploadError(
        `Could not check indexing status (${response.status}): ${detail}`,
        documentId,
      )
    }

    consecutiveFailures = 0
    let statusData: unknown
    try {
      statusData = await response.json()
    } catch {
      throw new DocumentUploadError('The backend returned an invalid indexing status.', documentId)
    }
    if (!statusData || typeof statusData !== 'object' || Array.isArray(statusData)) {
      throw new DocumentUploadError('The backend returned an invalid indexing status.', documentId)
    }

    const status = (statusData as Record<string, unknown>).status
    if (status === 'completed') {
      const chunks = (statusData as Record<string, unknown>).chunks
      if (typeof chunks !== 'number' || chunks < 1) {
        throw new DocumentUploadError(
          'Indexing finished without searchable passages. Retry the upload or use a text-based file.',
          documentId,
        )
      }
      return chunks
    }
    if (status === 'failed') {
      const error = (statusData as Record<string, unknown>).error
      throw new DocumentUploadError(
        typeof error === 'string' && error ? error : 'Document indexing failed.',
        documentId,
      )
    }
    if (status !== 'queued' && status !== 'processing') {
      throw new DocumentUploadError('The backend returned an unknown indexing status.', documentId)
    }

    onProgress(100, 'indexing')
    delayMs = 2000
  }

  throw new DocumentUploadError(
    'Indexing is taking longer than expected. The backend may still be working; refresh the library before retrying.',
    documentId,
  )
}

function postDocumentFile(
  apiUrl: string,
  file: File,
  onProgress: UploadProgress,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', `${trimSlash(apiUrl)}/upload`)
    request.timeout = 120000
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)), 'uploading')
    }
    request.onerror = () => reject(new Error(`Network error while uploading ${file.name}.`))
    request.ontimeout = () => reject(new Error(`Upload timed out while sending ${file.name}.`))
    request.onload = () => {
      let data: unknown
      try {
        data = JSON.parse(request.responseText)
      } catch {
        reject(new Error('The backend returned an invalid upload response.'))
        return
      }
      if (request.status < 200 || request.status >= 300) {
        const detail =
          data && typeof data === 'object' && 'detail' in data && typeof data.detail === 'string'
            ? data.detail
            : request.statusText
        reject(new Error(`Upload failed (${request.status}): ${detail}`))
        return
      }
      resolve(data)
    }

    const body = new FormData()
    body.append('file', file)
    request.send(body)
  })
}

export async function uploadDocument(
  apiUrl: string,
  file: File,
  onProgress: UploadProgress,
): Promise<{ chunks: number; documentId?: string }> {
  if (apiUrl) {
    onProgress(0, 'uploading')
    const data = await postDocumentFile(apiUrl, file, onProgress)
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('The backend returned an invalid upload response.')
    }

    const receipt = data as Record<string, unknown>
    const documentId = typeof receipt.document_id === 'string' ? receipt.document_id : undefined
    if (documentId && (receipt.status === 'processing' || receipt.status === 'queued')) {
      const chunks = await waitForDocumentIndexing(apiUrl, documentId, onProgress)
      return { chunks, documentId }
    }
    if (receipt.status === 'failed') {
      throw new DocumentUploadError(
        typeof receipt.error === 'string' ? receipt.error : 'Document indexing failed.',
        documentId,
      )
    }
    if (typeof receipt.chunks === 'number' && receipt.chunks > 0) {
      onProgress(100, 'indexing')
      return { chunks: receipt.chunks, documentId }
    }
    throw new DocumentUploadError(
      'The backend accepted the upload but did not return a valid indexing status.',
      documentId,
    )
  }
  for (let progress = 10; progress <= 100; progress += 15) {
    await sleep(120 + Math.random() * 120)
    onProgress(Math.min(progress, 100), progress >= 100 ? 'indexing' : 'uploading')
  }
  return { chunks: Math.max(4, Math.round(file.size / 1800)) }
}

export async function retryKnowledgeDocument(
  apiUrl: string,
  documentId: string,
  onProgress: UploadProgress,
): Promise<number> {
  const response = await fetch(
    `${trimSlash(apiUrl)}/documents/${encodeURIComponent(documentId)}/retry`,
    { method: 'POST', signal: AbortSignal.timeout(15000) },
  )
  if (!response.ok) {
    throw new Error(`Retry failed (${response.status}): ${await responseError(response)}`)
  }
  return waitForDocumentIndexing(apiUrl, documentId, onProgress)
}

async function mockQuery(
  question: string,
  topK: number,
  documents: KnowledgeDocument[],
): Promise<QueryResult> {
  await sleep(900 + Math.random() * 700)
  const ready = documents.filter((d) => d.status === 'ready')

  if (ready.length === 0) {
    return {
      answer:
        "I don't have any indexed documents to ground my answer yet. Upload PDFs, Markdown, or text files in the Documents tab and I'll retrieve the most relevant passages to answer your question.",
      sources: [],
    }
  }

  const sources: SourceCitation[] = ready.slice(0, topK).map((doc, i) => ({
    documentId: doc.id,
    documentName: doc.name,
    snippet: `…relevant passage from ${doc.name} matching "${question.slice(0, 48)}${question.length > 48 ? '…' : ''}"…`,
    score: Number((0.92 - i * 0.07).toFixed(2)),
  }))

  return {
    answer: `Based on ${sources.length} retrieved passage${sources.length === 1 ? '' : 's'} from your knowledge base, here is a synthesized answer.\n\nThe documents indicate that the topic you asked about is covered most directly in **${sources[0].documentName}**. The retrieved context highlights the key definitions, the main constraints involved, and the recommended next steps. Connect a live backend in Settings to get real, grounded answers.`,
    sources,
  }
}
