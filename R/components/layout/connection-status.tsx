import { RefreshCw } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useBackendStatus, type BackendState } from '@/hooks/use-backend-status'
import { translate } from '@/lib/i18n'
import type { UiLanguage } from '@/lib/types'
import { cn } from '@/lib/utils'

const STATUS_META: Record<BackendState, { label: 'connected' | 'demo' | 'checking' | 'disconnected'; dot: string; ring: string; text: string }> = {
  connected: { label: 'connected', dot: 'bg-success', ring: 'ring-success/25', text: 'text-success' },
  demo: { label: 'demo', dot: 'bg-brand', ring: 'ring-brand/25', text: 'text-brand' },
  checking: { label: 'checking', dot: 'bg-warning', ring: 'ring-warning/25', text: 'text-warning' },
  disconnected: {
    label: 'disconnected',
    dot: 'bg-destructive',
    ring: 'ring-destructive/25',
    text: 'text-destructive',
  },
}

export function ConnectionStatus({ language }: { language: UiLanguage }) {
  const { state, latencyMs, error, isValidating, refresh } = useBackendStatus()
  const meta = STATUS_META[state]

  const detail =
    state === 'disconnected'
      ? (error ?? translate(language, 'unavailable'))
      : state === 'demo'
        ? translate(language, 'demoDetail')
        : state === 'connected'
          ? translate(language, 'healthy', latencyMs ?? 0)
          : translate(language, 'healthCheck')

  return (
    <div className="flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger
          className={cn(
            'glass flex h-8 items-center gap-2 rounded-full px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <span className="relative flex size-2" aria-hidden="true">
            {(state === 'connected' || state === 'demo') && (
              <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-60', meta.dot)} />
            )}
            <span className={cn('relative inline-flex size-2 rounded-full ring-4', meta.dot, meta.ring)} />
          </span>
          <span className={meta.text} role="status" aria-live="polite">
            {translate(language, meta.label)}
          </span>
          {latencyMs !== undefined && state !== 'disconnected' && (
            <span className="hidden font-mono text-muted-foreground sm:inline">{latencyMs}ms</span>
          )}
        </TooltipTrigger>
        <TooltipContent>{detail}</TooltipContent>
      </Tooltip>
      <button
        type="button"
        onClick={refresh}
        aria-label={translate(language, 'recheck')}
        className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <RefreshCw className={cn('size-3.5', isValidating && 'animate-spin')} aria-hidden="true" />
      </button>
    </div>
  )
}
