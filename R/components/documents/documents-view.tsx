import { DocumentList } from './document-list'
import { UploadZone } from './upload-zone'
import { translate } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'

export function DocumentsView() {
  const { language } = useAppStore()
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-8">
        <div className="border-b border-brand/15 pb-5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-brand/75">
            {translate(language, 'knowledgeBase')}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            {translate(language, 'documents')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {translate(language, 'documentsSubtitle')}
          </p>
        </div>
        <UploadZone />
        <DocumentList />
      </div>
    </div>
  )
}
