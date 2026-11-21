import useSWR from 'swr'
import { checkHealth } from '@/lib/api'
import { useAppStore } from '@/store/app-store'

export type BackendState = 'checking' | 'connected' | 'demo' | 'disconnected'

export function useBackendStatus() {
  const { settings } = useAppStore()
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    ['health', settings.apiUrl],
    ([, url]) => checkHealth(url),
    { refreshInterval: 15000, shouldRetryOnError: false, revalidateOnFocus: true },
  )

  let state: BackendState = 'checking'
  if (error) state = 'disconnected'
  else if (data) state = data.mode === 'demo' ? 'demo' : 'connected'
  else if (isLoading) state = 'checking'

  return {
    state,
    latencyMs: data?.latencyMs,
    error: error instanceof Error ? error.message : undefined,
    isValidating,
    refresh: () => mutate(),
  }
}
