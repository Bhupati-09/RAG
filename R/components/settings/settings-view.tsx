import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useBackendStatus } from '@/hooks/use-backend-status'
import { isUiLanguage, LANGUAGE_LABELS, translate } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'

function SettingsCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="hud-panel rounded-2xl p-5 md:p-6">
      <h2 className="font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function SettingsView() {
  const { settings, updateSettings, language, setLanguage } = useAppStore()
  const { state } = useBackendStatus()
  const [apiUrl, setApiUrl] = useState(settings.apiUrl)

  const onSaveUrl = (e: FormEvent) => {
    e.preventDefault()
    updateSettings({ apiUrl: apiUrl.trim() })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 md:px-8">
        <SettingsCard
          title={translate(language, 'backendConnection')}
          description={translate(language, 'backendDescription')}
        >
          <form onSubmit={onSaveUrl} className="flex flex-col gap-2">
            <Label htmlFor="api-url">{translate(language, 'apiBaseUrl')}</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="api-url"
                type="url"
                inputMode="url"
                placeholder="https://api.example.com"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="font-mono"
              />
              <Button type="submit" disabled={apiUrl.trim() === settings.apiUrl}>
                {translate(language, 'save')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {translate(language, 'currentStatus', state)}
            </p>
          </form>
        </SettingsCard>

        <SettingsCard title={translate(language, 'retrieval')} description={translate(language, 'retrievalDescription')}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="top-k">{translate(language, 'topK')}</Label>
              <output htmlFor="top-k" className="font-mono text-sm text-brand">
                {settings.topK}
              </output>
            </div>
            <input
              id="top-k"
              type="range"
              min={1}
              max={10}
              value={settings.topK}
              onChange={(e) => updateSettings({ topK: Number(e.target.value) })}
              className="w-full accent-[var(--brand)]"
            />
          </div>
        </SettingsCard>

        <SettingsCard title={translate(language, 'display')} description={translate(language, 'displayDescription')}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="show-sources">{translate(language, 'showCitations')}</Label>
              <p className="mt-1 text-xs text-muted-foreground">{translate(language, 'citationDescription')}</p>
            </div>
            <Switch
              id="show-sources"
              checked={settings.showSources}
              onCheckedChange={(checked) => updateSettings({ showSources: checked })}
            />
          </div>
        </SettingsCard>

        <SettingsCard
          title={translate(language, 'language')}
          description={translate(language, 'languageDescription')}
        >
          <Label htmlFor="ui-language">{translate(language, 'language')}</Label>
          <select
            id="ui-language"
            value={language}
            onChange={(event) => {
              if (isUiLanguage(event.target.value)) setLanguage(event.target.value)
            }}
            className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </SettingsCard>
      </div>
    </div>
  )
}
