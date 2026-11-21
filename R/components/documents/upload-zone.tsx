import { CloudUpload } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'

const ACCEPTED_EXTENSIONS = ['pdf', 'md', 'txt', 'docx', 'csv', 'json', 'html']
const MAX_SIZE_MB = 25

function partitionFiles(files: File[]) {
  const valid: File[] = []
  const rejected: { filename: string; reason: 'unsupported' | 'tooLarge'; limit?: number }[] = []
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ACCEPTED_EXTENSIONS.includes(ext)) rejected.push({ filename: file.name, reason: 'unsupported' })
    else if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      rejected.push({ filename: file.name, reason: 'tooLarge', limit: MAX_SIZE_MB })
    }
    else valid.push(file)
  }
  return { valid, rejected }
}

export function UploadZone() {
  const { uploadFiles, language } = useAppStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [rejected, setRejected] = useState<string[]>([])

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return
    const result = partitionFiles(Array.from(list))
    setRejected(
      result.rejected.map(({ filename, reason, limit }) =>
        `${filename}: ${reason === 'unsupported' ? translate(language, 'unsupportedType') : translate(language, 'exceedsLimit', limit ?? MAX_SIZE_MB)}`,
      ),
    )
    if (result.valid.length) uploadFiles(result.valid)
  }

  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = (e: DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <section aria-labelledby="upload-heading">
      <div
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'hud-panel relative flex min-h-64 flex-col items-center justify-center overflow-hidden rounded-3xl border-dashed px-6 py-10 text-center transition-all duration-200',
          isDragging ? 'scale-[1.005] border-brand/65 bg-brand/[0.07]' : 'border-white/15 hover:border-brand/30',
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -top-24 left-1/2 size-56 -translate-x-1/2 rounded-full bg-brand/15 blur-2xl transition-opacity',
            isDragging ? 'opacity-100' : 'opacity-50',
          )}
        />
        <div
          className={cn(
            'relative flex size-14 items-center justify-center rounded-2xl bg-brand/[0.08] text-brand ring-1 ring-brand/20 shadow-[0_0_26px_oklch(0.84_0.14_195/10%)] transition-transform',
            isDragging && 'scale-110 text-brand ring-brand/40',
          )}
        >
          <CloudUpload className="size-6" strokeWidth={1.6} aria-hidden="true" />
        </div>
        <h2 id="upload-heading" className="relative mt-5 text-lg font-semibold tracking-tight">
          {translate(language, isDragging ? 'dropHeading' : 'uploadHeading')}
        </h2>
        <p className="relative mt-1 text-sm text-muted-foreground">
          {translate(language, 'uploadFormats', MAX_SIZE_MB)}
        </p>
        <Button
          type="button"
          variant="outline"
          className="relative mt-6 rounded-xl border-brand/20 bg-white/[0.035] px-5 hover:border-brand/35 hover:bg-white/[0.07]"
          onClick={() => inputRef.current?.click()}
        >
          {translate(language, 'browseFiles')}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(',')}
          className="sr-only"
          aria-label={translate(language, 'uploadDocuments')}
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {rejected.length > 0 && (
        <ul role="alert" className="mt-3 flex flex-col gap-1 text-xs text-destructive">
          {rejected.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
