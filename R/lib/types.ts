export type View = 'chat' | 'documents' | 'settings'
export type UiLanguage = 'en' | 'es' | 'fr' | 'de' | 'pt-BR' | 'ja' | 'te' | 'hi' | 'ta'

export type Role = 'user' | 'assistant'

export interface SourceCitation {
  documentId: string
  documentName: string
  snippet: string
  score: number
  page?: number
}

export interface ChatMessage {
  id: string
  role: Role
  content: string
  createdAt: number
  sources?: SourceCitation[]
  status?: 'pending' | 'done' | 'error'
}

export type DocumentStatus = 'uploading' | 'indexing' | 'ready' | 'error'

export interface KnowledgeDocument {
  id: string
  name: string
  size: number
  type: string
  status: DocumentStatus
  progress: number
  chunks?: number
  uploadedAt: number
  error?: string
}

export interface Settings {
  apiUrl: string
  topK: number
  showSources: boolean
}
