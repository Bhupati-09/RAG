import type { View } from '@/lib/types'
import { translate } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'
import { ConnectionStatus } from './connection-status'

const VIEW_COPY: Record<View, { title: 'chat' | 'documents' | 'settings'; subtitle: 'chatSubtitle' | 'documentsSubtitle' | 'settingsSubtitle' }> = {
  chat: { title: 'chat', subtitle: 'chatSubtitle' },
  documents: { title: 'documents', subtitle: 'documentsSubtitle' },
  settings: { title: 'settings', subtitle: 'settingsSubtitle' },
}

export function AppHeader() {
  const { view, language } = useAppStore()
  const { title, subtitle } = VIEW_COPY[view]

  return (
    <header className="glass relative z-10 flex h-[4.5rem] shrink-0 items-center justify-between gap-4 rounded-none border-x-0 border-t-0 border-b-brand/15 px-4 md:px-8">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/20 md:hidden">
            <span className="size-2 rounded-full bg-brand shadow-[0_0_12px_var(--brand)]" />
          </span>
          <div className="min-w-0">
            <p className="hidden font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-brand/80 md:block">
              KNOWLEDGE IQ // COMMAND
            </p>
            <h1 className="truncate text-base font-semibold tracking-tight md:text-lg">{translate(language, title)}</h1>
          </div>
        </div>
        <p className="hidden truncate text-xs text-muted-foreground md:block">{translate(language, subtitle)}</p>
      </div>
      <ConnectionStatus language={language} />
    </header>
  )
}
