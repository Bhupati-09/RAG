import { FileText } from 'lucide-react'
import { translate } from '@/lib/i18n'
import type { SourceCitation } from '@/lib/types'
import { useAppStore } from '@/store/app-store'

export function SourceCitations({ sources }: { sources: SourceCitation[] }) {
  const { language } = useAppStore()
  return (
    <div className="w-full">
      <p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {translate(language, 'sources', sources.length)}
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {sources.map((source, i) => (
          <li
            key={`${source.documentId}-${i}`}
            className="hud-panel rounded-xl p-3 transition-colors hover:border-brand/25"
          >
            <div className="flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded bg-brand/15 font-mono text-[10px] text-brand">
                {i + 1}
              </span>
              <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{source.documentName}</span>
              {source.page ? (
                <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-brand">
                  P.{source.page}
                </span>
              ) : null}
              <span className="font-mono text-[11px] text-muted-foreground" title={translate(language, 'similarity')}>
                {Math.round(source.score * 100)}%
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{source.snippet}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
