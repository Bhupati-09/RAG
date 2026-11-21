import { Eraser } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'
import { ChatComposer } from './chat-composer'
import { EmptyChat } from './empty-chat'
import { MessageBubble } from './message-bubble'

export function ChatView() {
  const { messages, settings, clearChat, isResponding, language } = useAppStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)

  useEffect(() => {
    const container = scrollRef.current
    if (!container || !shouldAutoScrollRef.current) return
    container.scrollTop = container.scrollHeight
  }, [messages])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scrollRef}
        onScroll={(event) => {
          const container = event.currentTarget
          shouldAutoScrollRef.current =
            container.scrollHeight - container.scrollTop - container.clientHeight < 120
        }}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {messages.length === 0 ? (
          <div className="flex min-h-full">
            <EmptyChat />
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-6">
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                disabled={isResponding}
                className="text-muted-foreground"
              >
                <Eraser data-icon="inline-start" aria-hidden="true" />
                {translate(language, 'clearChat')}
              </Button>
            </div>
            <ol className="flex flex-col gap-6" aria-label="Conversation" aria-live="polite">
              {messages.map((message) => (
                <li key={message.id}>
                  <MessageBubble message={message} showSources={settings.showSources} />
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      <div className="mx-auto w-full max-w-3xl px-4 pt-2 pb-4 md:px-6 md:pb-6">
        <ChatComposer />
      </div>
    </div>
  )
}
