import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import {
  deleteKnowledgeDocument,
  DocumentUploadError,
  listDocuments,
  queryKnowledge,
  retryKnowledgeDocument,
  uploadDocument,
  type UploadProgress,
} from '@/lib/api'
import { createId } from '@/lib/format'
import { isUiLanguage } from '@/lib/i18n'
import type { ChatMessage, KnowledgeDocument, Settings, UiLanguage, View } from '@/lib/types'

interface State {
  view: View
  language: UiLanguage
  messages: ChatMessage[]
  documents: KnowledgeDocument[]
  documentsLoading: boolean
  documentsError: string | null
  settings: Settings
}

type Action =
  | { type: 'setView'; view: View }
  | { type: 'setLanguage'; language: UiLanguage }
  | { type: 'addMessage'; message: ChatMessage }
  | { type: 'appendMessage'; id: string; content: string }
  | { type: 'updateMessage'; id: string; patch: Partial<ChatMessage> }
  | { type: 'clearChat' }
  | { type: 'addDocuments'; documents: KnowledgeDocument[] }
  | { type: 'replaceDocuments'; documents: KnowledgeDocument[] }
  | { type: 'setDocumentsLoading'; loading: boolean }
  | { type: 'setDocumentsError'; error: string | null }
  | { type: 'updateDocument'; id: string; patch: Partial<KnowledgeDocument> }
  | { type: 'removeDocument'; id: string }
  | { type: 'updateSettings'; patch: Partial<Settings> }

const initialState: State = {
  view: 'chat',
  language: 'en',
  messages: [],
  documents: [],
  documentsLoading: false,
  documentsError: null,
  settings: {
    apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
    topK: 4,
    showSources: true,
  },
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setView':
      return { ...state, view: action.view }
    case 'setLanguage':
      return { ...state, language: action.language }
    case 'addMessage':
      return { ...state, messages: [...state.messages, action.message] }
    case 'appendMessage':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, content: m.content + action.content } : m,
        ),
      }
    case 'updateMessage':
      return {
        ...state,
        messages: state.messages.map((m) => (m.id === action.id ? { ...m, ...action.patch } : m)),
      }
    case 'clearChat':
      return { ...state, messages: [] }
    case 'addDocuments':
      return { ...state, documents: [...action.documents, ...state.documents], documentsError: null }
    case 'replaceDocuments':
      return {
        ...state,
        documents: action.documents,
        documentsLoading: false,
        documentsError: null,
      }
    case 'setDocumentsLoading':
      return { ...state, documentsLoading: action.loading }
    case 'setDocumentsError':
      return { ...state, documentsLoading: false, documentsError: action.error }
    case 'updateDocument':
      return {
        ...state,
        documents: state.documents.map((d) => (d.id === action.id ? { ...d, ...action.patch } : d)),
      }
    case 'removeDocument':
      return { ...state, documents: state.documents.filter((d) => d.id !== action.id) }
    case 'updateSettings':
      return { ...state, settings: { ...state.settings, ...action.patch } }
  }
}

interface AppStore extends State {
  isResponding: boolean
  setView: (view: View) => void
  setLanguage: (language: UiLanguage) => void
  refreshDocuments: () => Promise<void>
  sendMessage: (content: string) => Promise<void>
  clearChat: () => void
  uploadFiles: (files: File[]) => void
  retryDocument: (id: string) => Promise<void>
  removeDocument: (id: string) => Promise<void>
  updateSettings: (patch: Partial<Settings>) => void
}

const AppStoreContext = createContext<AppStore | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const stateRef = useRef(state)
  const documentLoadRequest = useRef(0)
  stateRef.current = state

  const isResponding = state.messages.some((m) => m.status === 'pending')

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem('knowledge-iq-language')
    if (storedLanguage && isUiLanguage(storedLanguage)) {
      dispatch({ type: 'setLanguage', language: storedLanguage })
    }
    const storedSettings = window.localStorage.getItem('knowledge-iq-settings')
    if (storedSettings) {
      try {
        const parsed: unknown = JSON.parse(storedSettings)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Saved settings are not a valid object')
        }
        const saved = parsed as Record<string, unknown>
        const patch: Partial<Settings> = {}
        if (typeof saved.apiUrl === 'string') patch.apiUrl = saved.apiUrl
        if (typeof saved.topK === 'number' && Number.isInteger(saved.topK)) {
          patch.topK = Math.max(1, Math.min(10, saved.topK))
        }
        if (typeof saved.showSources === 'boolean') patch.showSources = saved.showSources
        dispatch({ type: 'updateSettings', patch })
      } catch (error) {
        console.error('Could not restore saved application settings', error)
      }
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = state.language
    window.localStorage.setItem('knowledge-iq-language', state.language)
  }, [state.language])

  const setView = useCallback((view: View) => dispatch({ type: 'setView', view }), [])
  const setLanguage = useCallback((language: UiLanguage) => {
    dispatch({ type: 'setLanguage', language })
  }, [])
  const refreshDocuments = useCallback(async () => {
    const requestId = ++documentLoadRequest.current
    const { apiUrl } = stateRef.current.settings
    if (!apiUrl) {
      if (requestId === documentLoadRequest.current) {
        dispatch({ type: 'replaceDocuments', documents: [] })
      }
      return
    }
    dispatch({ type: 'setDocumentsLoading', loading: true })
    try {
      const documents = await listDocuments(apiUrl)
      if (requestId === documentLoadRequest.current) {
        dispatch({ type: 'replaceDocuments', documents })
      }
    } catch (error) {
      if (requestId === documentLoadRequest.current) {
        dispatch({
          type: 'setDocumentsError',
          error: error instanceof Error ? error.message : 'Could not load saved documents.',
        })
      }
    }
  }, [])

  useEffect(() => {
    void refreshDocuments()
  }, [state.settings.apiUrl, refreshDocuments])
  const clearChat = useCallback(() => dispatch({ type: 'clearChat' }), [])
  const removeDocument = useCallback(async (id: string) => {
    const { apiUrl } = stateRef.current.settings
    try {
      if (apiUrl) await deleteKnowledgeDocument(apiUrl, id)
      dispatch({ type: 'removeDocument', id })
    } catch (error) {
      dispatch({
        type: 'updateDocument',
        id,
        patch: {
          error: error instanceof Error ? error.message : 'Could not remove document.',
        },
      })
    }
  }, [])
  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      const settings = { ...stateRef.current.settings, ...patch }
      dispatch({ type: 'updateSettings', patch })
      try {
        window.localStorage.setItem('knowledge-iq-settings', JSON.stringify(settings))
      } catch (error) {
        console.error('Could not save application settings', error)
      }
    },
    [],
  )

  const sendMessage = useCallback(async (content: string) => {
    const { settings, documents } = stateRef.current
    const history = stateRef.current.messages
      .filter(
        (message) =>
          (message.role === 'user' || message.role === 'assistant') &&
          message.status !== 'pending' &&
          message.status !== 'error',
      )
      .slice(-8)
      .map(({ role, content: messageContent }) => ({ role, content: messageContent }))
    dispatch({
      type: 'addMessage',
      message: { id: createId(), role: 'user', content, createdAt: Date.now(), status: 'done' },
    })
    const replyId = createId()
    dispatch({
      type: 'addMessage',
      message: { id: replyId, role: 'assistant', content: '', createdAt: Date.now(), status: 'pending' },
    })
    let streamedContent = ''
    let streamFlushTimer: ReturnType<typeof setTimeout> | undefined
    const flushStreamedContent = () => {
      if (streamFlushTimer) {
        clearTimeout(streamFlushTimer)
        streamFlushTimer = undefined
      }
      if (!streamedContent) return
      dispatch({ type: 'appendMessage', id: replyId, content: streamedContent })
      streamedContent = ''
    }
    try {
      const result = await queryKnowledge(
        settings.apiUrl,
        content,
        settings.topK,
        documents,
        (token) => {
          streamedContent += token
          if (!streamFlushTimer) {
            streamFlushTimer = setTimeout(flushStreamedContent, 50)
          }
        },
        history,
      )
      flushStreamedContent()
      dispatch({
        type: 'updateMessage',
        id: replyId,
        patch: { content: result.answer, sources: result.sources, status: 'done', createdAt: Date.now() },
      })
    } catch (error) {
      flushStreamedContent()
      dispatch({
        type: 'updateMessage',
        id: replyId,
        patch: {
          content: error instanceof Error ? error.message : 'Something went wrong while querying the backend.',
          status: 'error',
        },
      })
    }
  }, [])

  const uploadFiles = useCallback((files: File[]) => {
    const { apiUrl } = stateRef.current.settings
    const entries = files.map((file) => ({
      file,
      doc: {
        id: createId(),
        name: file.name,
        size: file.size,
        type: file.type || file.name.split('.').pop() || 'file',
        status: 'uploading',
        progress: 0,
        uploadedAt: Date.now(),
      } satisfies KnowledgeDocument,
    }))
    dispatch({ type: 'addDocuments', documents: entries.map((e) => e.doc) })

    const queue = [...entries]
    const uploadNext = async () => {
      while (queue.length > 0) {
        const entry = queue.shift()
        if (!entry) return
        const onProgress: UploadProgress = (progress, stage) =>
          dispatch({
            type: 'updateDocument',
            id: entry.doc.id,
            patch: { progress, status: stage },
          })
        try {
          const { chunks, documentId } = await uploadDocument(apiUrl, entry.file, onProgress)
          dispatch({
            type: 'updateDocument',
            id: entry.doc.id,
            patch: {
              id: documentId ?? entry.doc.id,
              status: 'ready',
              progress: 100,
              chunks,
              error: undefined,
            },
          })
        } catch (error) {
          const patch: Partial<KnowledgeDocument> = {
            status: 'error',
            error: error instanceof Error ? error.message : 'Upload failed',
          }
          if (error instanceof DocumentUploadError && error.documentId) patch.id = error.documentId
          dispatch({ type: 'updateDocument', id: entry.doc.id, patch })
        }
      }
    }

    const workerCount = Math.min(2, queue.length)
    for (let worker = 0; worker < workerCount; worker += 1) {
      void uploadNext()
    }
  }, [])

  const retryDocument = useCallback(async (id: string) => {
    const { apiUrl } = stateRef.current.settings
    if (!apiUrl) return
    dispatch({
      type: 'updateDocument',
      id,
      patch: { status: 'indexing', progress: 100, error: undefined },
    })
    const onProgress: UploadProgress = (progress, stage) =>
      dispatch({ type: 'updateDocument', id, patch: { progress, status: stage } })
    try {
      const chunks = await retryKnowledgeDocument(apiUrl, id, onProgress)
      dispatch({
        type: 'updateDocument',
        id,
        patch: { status: 'ready', progress: 100, chunks, error: undefined },
      })
    } catch (error) {
      dispatch({
        type: 'updateDocument',
        id,
        patch: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Could not retry document indexing.',
        },
      })
    }
  }, [])

  const value = useMemo<AppStore>(
    () => ({
      ...state,
      isResponding,
      documentsLoading: state.documentsLoading,
      documentsError: state.documentsError,
      setView,
      setLanguage,
      refreshDocuments,
      sendMessage,
      clearChat,
      uploadFiles,
      retryDocument,
      removeDocument,
      updateSettings,
    }),
    [
      state,
      isResponding,
      setView,
      setLanguage,
      refreshDocuments,
      sendMessage,
      clearChat,
      uploadFiles,
      retryDocument,
      removeDocument,
      updateSettings,
    ],
  )

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useAppStore() {
  const ctx = useContext(AppStoreContext)
  if (!ctx) throw new Error('useAppStore must be used within AppStoreProvider')
  return ctx
}
