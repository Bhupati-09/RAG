import { BrainCircuit, FileSearch, Lightbulb, ListChecks, type LucideIcon } from 'lucide-react'
import { translate } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'

const SUGGESTIONS: {
  icon: LucideIcon
  text: 'suggestionSummary' | 'suggestionActions' | 'suggestionExplain'
  prompt: string
}[] = [
  { icon: FileSearch, text: 'suggestionSummary', prompt: 'Summarize the key points across my documents' },
  { icon: ListChecks, text: 'suggestionActions', prompt: 'What action items are mentioned in the latest report?' },
  { icon: Lightbulb, text: 'suggestionExplain', prompt: 'Explain the main concepts in simple terms' },
]

export function EmptyChat() {
  const { sendMessage, language } = useAppStore()

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-8 text-center md:px-8 md:py-10">
      <div className="relative mb-6 flex h-24 w-48 items-center justify-center">
        <div aria-hidden="true" className="absolute inset-0 rounded-full bg-brand/[0.08] blur-2xl" />
        <div aria-hidden="true" className="orbit-ring absolute size-24 rounded-full border border-dashed border-brand/25" />
        <div aria-hidden="true" className="orbit-ring-reverse absolute size-[5.25rem] rounded-full border border-chart-4/20" />
        <div aria-hidden="true" className="absolute left-5 top-6 h-14 w-11 -rotate-12 rounded-xl border border-brand/15 bg-brand/[0.035]" />
        <div aria-hidden="true" className="absolute right-5 top-4 h-14 w-11 rotate-12 rounded-xl border border-chart-4/20 bg-chart-4/[0.04]" />
        <div className="hud-panel relative flex size-[4.25rem] items-center justify-center rounded-[1.35rem] text-brand ring-1 ring-brand/25 shadow-[0_0_34px_oklch(0.84_0.14_195/12%)]">
          <BrainCircuit className="size-8" strokeWidth={1.5} aria-hidden="true" />
        </div>
        <span aria-hidden="true" className="absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-brand shadow-[0_0_16px_var(--brand)]" />
      </div>
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/[0.07] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-brand/90">
        <span className="size-1.5 rounded-full bg-brand shadow-[0_0_10px_var(--brand)]" />
        {translate(language, 'privateIntelligence')}
      </div>
      <h2 className="text-balance text-3xl font-semibold tracking-[-0.045em] md:text-5xl">
        {translate(language, 'emptyHeading')}
      </h2>
      <p className="mt-3 max-w-lg text-pretty text-sm leading-7 text-muted-foreground md:text-base">
        {translate(language, 'emptyDescription')}
      </p>
      <ul className="mt-7 grid w-full max-w-4xl gap-3 sm:grid-cols-3">
        {SUGGESTIONS.map(({ icon: Icon, text, prompt }) => (
          <li key={text}>
            <button
              type="button"
              onClick={() => sendMessage(prompt)}
              className="hud-panel group flex h-full w-full flex-col items-start gap-4 rounded-2xl p-5 text-left text-sm text-muted-foreground transition duration-200 hover:-translate-y-1 hover:border-brand/35 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand/[0.08] text-brand ring-1 ring-brand/15 transition-colors group-hover:bg-brand/15">
                <Icon className="size-4" strokeWidth={1.7} aria-hidden="true" />
              </span>
              <span className="text-pretty leading-relaxed">{translate(language, text)}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-7 text-[11px] tracking-wide text-muted-foreground/65">
        {translate(language, 'localDocuments')}
      </p>
    </div>
  )
}
