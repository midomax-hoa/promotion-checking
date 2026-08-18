'use client'

/**
 * The only client component on the check screen, and it holds nothing but the
 * drop target and the "working on it" state. Everything about the *result* is
 * rendered on the server, so no finding ever passes through here.
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { MAX_UPLOAD_MB } from '@/lib/excel/upload-limits'
import { cn } from '@/lib/utils'

const ACCEPTED = '.xlsx,.xls'

export function UploadPanel() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  // dragenter/dragleave also fire when the pointer crosses a *child* of the
  // drop zone, so a plain boolean flickers off the moment the cursor reaches
  // the button in the middle. Counting entries and leaves is what makes the
  // highlight hold steady across the whole zone.
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    setBusy(true)
    setError(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const response = await fetch('/api/check', { method: 'POST', body })
      const payload = (await response.json().catch(() => null)) as
        | { runId?: string; error?: string }
        | null

      if (!response.ok || !payload?.runId) {
        throw new Error(payload?.error ?? `Máy chủ trả lỗi ${response.status}.`)
      }
      // Kept busy across the navigation: the result page is server rendered and
      // takes a moment, and a button that springs back to "ready" looks broken.
      router.push(`/ket-qua/${payload.runId}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không gọi được tuyến kiểm tra.')
      setBusy(false)
    }
  }

  function resetDrag() {
    dragDepth.current = 0
    setDragging(false)
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    resetDrag()
    if (busy) return
    const file = event.dataTransfer.files[0]
    if (file) void upload(file)
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragEnter={(event) => {
          event.preventDefault()
          dragDepth.current += 1
          if (!busy) setDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => {
          dragDepth.current -= 1
          if (dragDepth.current <= 0) resetDrag()
        }}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors',
          dragging
            ? 'border-primary bg-primary/10 ring-4 ring-primary/15'
            : 'border-border bg-muted/30 hover:border-muted-foreground/40',
          busy && 'pointer-events-none opacity-70',
        )}
      >
        {busy ? (
          <Loader2 aria-hidden className="size-8 animate-spin text-primary" />
        ) : dragging ? (
          <FileSpreadsheet aria-hidden className="size-8 text-primary" />
        ) : (
          <UploadCloud aria-hidden className="size-8 text-muted-foreground" />
        )}

        <p
          // aria-live so the state change is announced, not only painted.
          aria-live="polite"
          className={cn('text-sm', dragging ? 'font-medium text-primary' : 'text-muted-foreground')}
        >
          {busy
            ? 'Đang đọc file và chạy luật kiểm tra...'
            : dragging
              ? 'Thả file ra để bắt đầu kiểm tra'
              : 'Kéo thả file .xlsx vào đây, hoặc bấm để chọn'}
        </p>

        <Button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? 'Đang kiểm tra...' : 'Chọn file'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            // Reset so picking the same file twice fires change again.
            event.target.value = ''
            if (file) void upload(file)
          }}
        />
        <p className="text-xs text-muted-foreground">
          Tối đa {MAX_UPLOAD_MB} MB. File được giữ lại trên máy chủ để xuất báo cáo, không gửi đi
          đâu khác.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
