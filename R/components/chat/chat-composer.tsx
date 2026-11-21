import { ArrowUp, Paperclip } from 'lucide-react'
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'

export function ChatComposer() {
  const { sendMessage, isResponding, setView, documents, language } = useAppStore()
  const [value, setValue] = useState('')
  const readyCount = documents.filter((d) => d.status === 'ready').length
  const canSend = value.trim().length > 0 && !isResponding

  const submit = () => {
    if (!canSend) return
    sendMessage(value.trim())
    setValue('')
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    submit()
  }

  return (
    <form onSubmit={onSubmit} className="hud-panel relative rounded-2xl p-2 transition-colors focus-within:border-brand/50 focus-within:shadow-[0_0_30px_oklch(0.84_0.14_195/8%)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent" />
      <label htmlFor="chat-input" className="sr-only">
        {translate(language, 'askQuestion')}
      </label>
      <textarea
        id="chat-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder={translate(language, 'chatPlaceholder')}
        className="field-sizing-content max-h-48 min-h-12 w-full resize-none bg-transparent px-3 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          onClick={() => setView('documents')}
          className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground transition-colors outline-none hover:bg-brand/[0.08] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Paperclip className="size-3.5" aria-hidden="true" />
          <span>
            {translate(language, readyCount === 1 ? 'sourceCountOne' : 'sourceCount', readyCount)}
          </span>
        </button>
        <div className="flex items-center gap-2">
          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            {translate(language, 'enterHint')}
          </span>
          <Button
            type="submit"
            size="icon"
            disabled={!canSend}
            aria-label={translate(language, 'send')}
            className="size-9 rounded-xl bg-brand text-brand-foreground shadow-lg shadow-brand/15 transition-transform hover:scale-[1.03] hover:bg-brand/90 active:scale-95"
          >
            <ArrowUp className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </form>
  )
}
