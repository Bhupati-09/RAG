import { BrainCircuit, FileStack, MessagesSquare, Settings2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { View } from '@/lib/types'
import { translate } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'
import { KnowledgeBaseStatus } from './knowledge-base-status'

interface NavItem {
  id: View
  label: 'chat' | 'documents' | 'settings'
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { id: 'chat', label: 'chat', icon: MessagesSquare },
  { id: 'documents', label: 'documents', icon: FileStack },
  { id: 'settings', label: 'settings', icon: Settings2 },
]

export function AppSidebar() {
  const { view, setView, documents, messages, language } = useAppStore()
  const readyDocs = documents.filter((d) => d.status === 'ready')
  const totalChunks = readyDocs.reduce((sum, d) => sum + (d.chunks ?? 0), 0)

  const counts: Partial<Record<View, number>> = {
    chat: messages.filter((m) => m.role === 'user').length,
    documents: documents.length,
  }

  return (
    <aside className="glass fixed inset-x-0 bottom-0 z-30 flex h-16 w-full shrink-0 flex-row border-x-0 border-b-0 md:relative md:inset-auto md:h-auto md:w-64 md:flex-col md:rounded-none md:border-y-0 md:border-l-0 md:border-r-brand/15">
      <div className="hidden h-20 items-center gap-3 px-5 md:flex">
        <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/[0.12] text-brand ring-1 ring-brand/30 shadow-[0_0_24px_oklch(0.84_0.14_195/12%)]">
          <BrainCircuit className="size-5" aria-hidden="true" />
          <span aria-hidden="true" className="absolute -right-1 -top-1 size-2 rounded-full bg-brand shadow-[0_0_12px_var(--brand)]" />
        </div>
        <div className="hidden min-w-0 md:block">
          <p className="truncate text-sm font-bold tracking-[0.04em]">KNOWLEDGE IQ</p>
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-brand/70">{translate(language, 'ragSubtitle')}</p>
        </div>
      </div>

      <nav aria-label="Primary" className="flex flex-1 flex-row items-center justify-around gap-1 px-2 md:flex-col md:items-stretch md:justify-start md:px-3 md:py-4">
        <p className="mb-2 hidden px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground md:block">
          {translate(language, 'workspace')}
        </p>
        {NAV_ITEMS.map((item) => {
          const active = view === item.id
          const count = counts[item.id]
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              aria-current={active ? 'page' : undefined}
              title={translate(language, item.label)}
              className={cn(
                'group relative flex h-12 min-w-16 flex-col items-center justify-center gap-1 rounded-xl border border-transparent px-2 text-[10px] font-medium text-muted-foreground transition-all duration-200 outline-none hover:-translate-y-0.5 hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:h-11 md:min-w-0 md:flex-row md:justify-start md:gap-3 md:rounded-xl md:px-3 md:text-sm',
                active && 'border-brand/20 bg-brand/[0.08] text-foreground shadow-[inset_0_0_24px_oklch(0.84_0.14_195/5%)]',
              )}
            >
              {active && (
                <span aria-hidden="true" className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand md:inset-y-2 md:left-0 md:right-auto md:h-auto md:w-0.5" />
              )}
              <item.icon className={cn('size-4 shrink-0', active && 'text-brand')} aria-hidden="true" />
              <span className="md:hidden">{translate(language, item.label)}</span>
              <span className="hidden md:inline">{translate(language, item.label)}</span>
              {count ? (
                <span className="ml-auto hidden rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground md:inline">
                  {count}
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>

      <div className="hidden p-3 md:block">
        <KnowledgeBaseStatus
          documentCount={readyDocs.length}
          chunkCount={totalChunks}
          language={language}
        />
      </div>
    </aside>
  )
}
