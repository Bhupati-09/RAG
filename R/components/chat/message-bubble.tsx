import { AlertCircle, BrainCircuit, User } from 'lucide-react'
import { Fragment, memo, type ReactNode } from 'react'
import { formatTime } from '@/lib/format'
import { translate } from '@/lib/i18n'
import type { ChatMessage } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { SourceCitations } from './source-citations'

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.9em]">{part.slice(1, -1)}</code>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}

function renderMarkdown(text: string): ReactNode[] {
  const blocks: ReactNode[] = []
  let paragraph: string[] = []
  let listItems: string[] = []
  let listType: 'unordered' | 'ordered' | null = null
  let key = 0

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    blocks.push(
      <p key={key++} className="text-pretty whitespace-pre-wrap">
        {renderInline(paragraph.join(' '))}
      </p>,
    )
    paragraph = []
  }

  const flushList = () => {
    if (listItems.length === 0 || !listType) return
    const List = listType === 'unordered' ? 'ul' : 'ol'
    blocks.push(
      <List key={key++} className={listType === 'unordered' ? 'list-disc pl-5' : 'list-decimal pl-5'}>
        {listItems.map((item, index) => <li key={index} className="pl-1">{renderInline(item)}</li>)}
      </List>,
    )
    listItems = []
    listType = null
  }

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushParagraph()
      flushList()
      continue
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      flushList()
      const Heading = heading[1].length === 1 ? 'h2' : 'h3'
      blocks.push(
        <Heading key={key++} className="font-semibold text-foreground">
          {renderInline(heading[2])}
        </Heading>,
      )
      continue
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)$/)
    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/)
    const listMatch = unordered ?? ordered
    if (listMatch) {
      flushParagraph()
      const nextListType = unordered ? 'unordered' : 'ordered'
      if (listType && listType !== nextListType) flushList()
      listType = nextListType
      listItems.push(listMatch[1])
      continue
    }

    flushList()
    paragraph.push(trimmed)
  }

  flushParagraph()
  flushList()
  return blocks
}

function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="Assistant is thinking">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
      <span className="ml-2 text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export const MessageBubble = memo(function MessageBubble({
  message,
  showSources,
}: {
  message: ChatMessage
  showSources: boolean
}) {
  const { language } = useAppStore()
  const isUser = message.role === 'user'
  const isError = message.status === 'error'

  return (
    <div className={cn('flex w-full gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        aria-hidden="true"
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg ring-1',
          isUser ? 'bg-white/5 text-foreground ring-border' : 'bg-brand/15 text-brand ring-brand/30',
        )}
      >
        {isUser ? <User className="size-4" /> : <BrainCircuit className="size-4" />}
      </div>

      <div className={cn('flex max-w-[85%] flex-col gap-1.5 md:max-w-[75%]', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'rounded-tr-sm border border-brand/30 bg-brand/[0.11] text-foreground'
              : 'glass rounded-tl-sm text-foreground/90',
            isError && 'border-destructive/40 text-destructive',
          )}
        >
          <span className="sr-only">{translate(language, isUser ? 'youSaid' : 'assistantReplied')}</span>
          {message.status === 'pending' && !message.content ? (
            <TypingIndicator label={translate(language, 'generating')} />
          ) : (
            <div className="flex flex-col gap-3">
              {isError && (
                <p className="flex items-center gap-2 font-medium">
                  <AlertCircle className="size-4" aria-hidden="true" />
                  {translate(language, 'requestFailed')}
                </p>
              )}
              {renderMarkdown(message.content)}
              {message.status === 'pending' && <TypingIndicator label={translate(language, 'generating')} />}
            </div>
          )}
        </div>

        {!isUser && showSources && message.sources && message.sources.length > 0 && (
          <SourceCitations sources={message.sources} />
        )}

        {message.status !== 'pending' && (
          <time className="px-1 font-mono text-[11px] text-muted-foreground" dateTime={new Date(message.createdAt).toISOString()}>
            {formatTime(message.createdAt, language)}
          </time>
        )}
      </div>
    </div>
  )
})
