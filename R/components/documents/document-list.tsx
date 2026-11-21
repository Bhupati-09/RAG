import { CheckCircle2, FileText, Loader2, RefreshCw, Trash2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatBytes } from '@/lib/format'
import { translate } from '@/lib/i18n'
import type { DocumentStatus, KnowledgeDocument } from '@/lib/types'
import type { UiLanguage } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'

const STATUS_LABEL: Record<DocumentStatus, 'uploading' | 'indexing' | 'ready' | 'failed'> = {
  uploading: 'uploading',
  indexing: 'indexing',
  ready: 'ready',
  error: 'failed',
}

function StatusBadge({ status, language }: { status: DocumentStatus; language: UiLanguage }) {
  const Icon = status === 'ready' ? CheckCircle2 : status === 'error' ? XCircle : Loader2
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 border-transparent font-normal',
        status === 'ready' && 'bg-success/10 text-success',
        status === 'error' && 'bg-destructive/10 text-destructive',
        (status === 'uploading' || status === 'indexing') && 'bg-brand/10 text-brand',
      )}
    >
      <Icon className={cn('size-3', (status === 'uploading' || status === 'indexing') && 'animate-spin')} aria-hidden="true" />
      {translate(language, STATUS_LABEL[status])}
    </Badge>
  )
}

function DocumentRow({ doc }: { doc: KnowledgeDocument }) {
  const { removeDocument, retryDocument, settings, language } = useAppStore()
  const ext = doc.name.split('.').pop()?.toUpperCase() ?? 'FILE'
  const inProgress = doc.status === 'uploading' || doc.status === 'indexing'

  return (
    <li className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-white/[0.035]">
      <div className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/[0.06] ring-1 ring-brand/10">
        <FileText className="size-4 text-brand/80" aria-hidden="true" />
        <span className="absolute -bottom-1 rounded bg-secondary px-1 font-mono text-[9px] leading-tight text-muted-foreground">
          {ext.slice(0, 4)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{doc.name}</p>
        </div>
        {inProgress ? (
          <div
            className="mt-2 h-1 w-full max-w-xs overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuenow={doc.status === 'uploading' ? doc.progress : undefined}
            aria-valuemin={doc.status === 'uploading' ? 0 : undefined}
            aria-valuemax={doc.status === 'uploading' ? 100 : undefined}
            aria-label={`${doc.name} ${translate(language, doc.status === 'indexing' ? 'indexing' : 'uploading').toLowerCase()}`}
          >
            <div
              className={cn(
                'h-full rounded-full bg-brand',
                doc.status === 'indexing' ? 'w-2/5 animate-progress' : 'transition-[width]',
              )}
              style={doc.status === 'uploading' ? { width: `${doc.progress}%` } : undefined}
            />
          </div>
        ) : null}
        <p className={cn('mt-1 font-mono text-xs text-muted-foreground', doc.error && 'text-destructive')}>
          {formatBytes(doc.size, language)}
          {doc.chunks ? ` · ${doc.chunks} chunks` : ''}
          {doc.error ? ` · ${doc.error}` : ''}
        </p>
      </div>
      <StatusBadge status={doc.status} language={language} />
      {doc.status === 'error' && settings.apiUrl && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void retryDocument(doc.id)}
          aria-label={`${translate(language, 'retry')} ${doc.name}`}
          className="text-brand hover:text-brand"
        >
          <RefreshCw data-icon="inline-start" aria-hidden="true" />
          {translate(language, 'retry')}
        </Button>
      )}
      <button
        type="button"
        onClick={() => removeDocument(doc.id)}
        aria-label={translate(language, 'removeDocument', doc.name)}
        disabled={inProgress}
        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground opacity-100 transition-all outline-none hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-30 md:opacity-0 md:group-hover:opacity-100"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </li>
  )
}

export function DocumentList() {
  const { documents, documentsLoading, documentsError, refreshDocuments, language } = useAppStore()

  return (
    <section aria-labelledby="library-heading" className="glass overflow-hidden rounded-2xl shadow-lg shadow-black/10">
      <div className="flex items-center justify-between border-b border-border bg-white/[0.015] px-4 py-4">
        <h2 id="library-heading" className="text-sm font-semibold tracking-tight">
          {translate(language, 'library')}
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          {translate(language, documents.length === 1 ? 'filesOne' : 'filesMany', documents.length)}
        </span>
      </div>
      {documentsError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b border-destructive/20 bg-destructive/[0.04] px-4 py-3">
          <p className="min-w-0 text-xs text-destructive">{documentsError}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refreshDocuments()}>
            <RefreshCw data-icon="inline-start" aria-hidden="true" />
            {translate(language, 'retry')}
          </Button>
        </div>
      )}
      {documents.length === 0 ? (
        documentsLoading ? (
          <p role="status" className="px-4 py-10 text-center text-sm text-muted-foreground">
            {translate(language, 'loadingDocuments')}
          </p>
        ) : documentsError ? null : (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {translate(language, 'noDocuments')}
          </p>
        )
      ) : (
        <ul className="divide-y divide-border">
          {documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} />
          ))}
        </ul>
      )}
    </section>
  )
}
