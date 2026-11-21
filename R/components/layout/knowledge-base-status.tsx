import { Database } from 'lucide-react'
import { translate } from '@/lib/i18n'
import type { UiLanguage } from '@/lib/types'

interface KnowledgeBaseStatusProps {
  documentCount: number
  chunkCount: number
  language: UiLanguage
}

export function KnowledgeBaseStatus({
  documentCount,
  chunkCount,
  language,
}: KnowledgeBaseStatusProps) {
  const active = documentCount > 0

  return (
    <section
      aria-label={translate(language, 'knowledgeBase')}
      className="hud-panel rounded-xl p-3"
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Database className="size-4 shrink-0 text-brand/80" aria-hidden="true" />
          <span className="truncate text-xs font-medium text-foreground/80">
            {translate(language, 'knowledgeBase')}
          </span>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium ${
            active
              ? 'bg-brand/15 text-brand'
              : 'bg-amber-500/20 text-amber-400'
          }`}
          role="status"
        >
          <span
            aria-hidden="true"
            className={`relative size-1.5 rounded-full ${
              active ? 'bg-brand' : 'bg-amber-400'
            }`}
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-inherit opacity-60" />
          </span>
          {translate(language, active ? 'active' : 'idle')}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold leading-5 text-foreground">{documentCount}</p>
          <p className="whitespace-nowrap text-[10px] font-medium uppercase leading-4 tracking-wider text-muted-foreground">
            {translate(language, 'documents')}
          </p>
        </div>
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold leading-5 text-foreground">{chunkCount}</p>
          <p className="whitespace-nowrap text-[10px] font-medium uppercase leading-4 tracking-wider text-muted-foreground">
            {translate(language, 'chunks')}
          </p>
        </div>
      </div>
    </section>
  )
}
