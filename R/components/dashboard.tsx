'use client'

import { ChatView } from '@/components/chat/chat-view'
import { DocumentsView } from '@/components/documents/documents-view'
import { AppHeader } from '@/components/layout/app-header'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SettingsView } from '@/components/settings/settings-view'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppStoreProvider, useAppStore } from '@/store/app-store'

function ActiveView() {
  const { view } = useAppStore()
  if (view === 'documents') return <DocumentsView />
  if (view === 'settings') return <SettingsView />
  return <ChatView />
}

export function Dashboard() {
  return (
    <AppStoreProvider>
      <TooltipProvider>
        <div className="relative flex h-dvh overflow-hidden bg-background">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-56 left-[38%] size-[36rem] rounded-full bg-brand/[0.08] blur-[96px]" />
            <div className="absolute -bottom-64 -right-40 size-[32rem] rounded-full bg-chart-4/[0.07] blur-[96px]" />
          </div>
          <AppSidebar />
          <main className="relative flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
            <AppHeader />
            <div className="min-h-0 flex-1 animate-enter">
              <ActiveView />
            </div>
          </main>
        </div>
      </TooltipProvider>
    </AppStoreProvider>
  )
}
