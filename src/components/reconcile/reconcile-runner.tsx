'use client'

/**
 * Starts a reconciliation and narrates it while it runs.
 *
 * The narration matters more here than on the sync screen. A run deliberately
 * pauses for several seconds between its two passes, and without a line saying
 * why, that pause is indistinguishable from a hang.
 *
 * Nothing about the result travels through here: when the run finishes the
 * browser navigates to the server-rendered result page.
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { MAX_UPLOAD_MB } from '@/lib/excel/upload-limits'
import { readNdjson } from '@/lib/ndjson-stream'
import type { ReconcileSourceOption } from '@/lib/reconcile/reconcile-queries'

type ReconcileEvent =
  | { type: 'start' }
  | { type: 'fetch'; page: number; promotions: number; done: boolean }
  | { type: 'reconcile'; phase: string; pass: number; promotions: number; notFound: number }
  | { type: 'done'; result: { runId: string } }
  | { type: 'error'; message: string }

const PHASE_LABELS: Record<string, string> = {
  'pass-1': 'Đã kiểm lượt 1',
  waiting: 'Chờ Haravan cập nhật danh sách rồi kiểm lại lượt 2',
  'pass-2': 'Đã kiểm lượt 2',
  rules: 'Đang so từng chương trình',
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(value)
}

export function ReconcileRunner({ sources }: { sources: readonly ReconcileSourceOption[] }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function start(body: FormData) {
    setRunning(true)
    setStatus('Đang kéo danh sách chương trình từ Haravan...')
    setError(null)

    try {
      const response = await fetch('/api/reconcile', { method: 'POST', body })
      if (!response.ok || !response.body) {
        const detail = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(detail?.error ?? `Máy chủ trả lỗi ${response.status}.`)
      }

      let runId: string | null = null
      for await (const event of readNdjson<ReconcileEvent>(response.body)) {
        if (event.type === 'fetch') {
          setStatus(`Đang kéo chương trình: trang ${event.page}, ${event.promotions} chương trình`)
        }
        if (event.type === 'reconcile') {
          const label = PHASE_LABELS[event.phase] ?? event.phase
          setStatus(
            event.phase === 'waiting'
              ? label
              : `${label} — ${event.promotions} chương trình, ${event.notFound} chưa thấy`,
          )
        }
        if (event.type === 'done') runId = event.result.runId
        if (event.type === 'error') setError(event.message)
      }

      // Kept busy across the navigation: the result page renders on the server
      // and a button springing back to "ready" looks like nothing happened.
      if (runId) router.push(`/doi-soat/${runId}`)
      else setRunning(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không gọi được tuyến đối soát.')
      setRunning(false)
    }
  }

  function reconcileRun(runId: string) {
    const body = new FormData()
    body.append('runId', runId)
    void start(body)
  }

  function reconcileFile(file: File) {
    const body = new FormData()
    body.append('file', file)
    void start(body)
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Chọn một lần đã kiểm tra</h2>
        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có lần kiểm tra nào còn giữ file gốc. Tải file Excel lên ở dưới.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            {sources.map((source) => (
              <div
                key={source.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-sm last:border-b-0"
              >
                <span className="min-w-40 flex-1 truncate font-medium">{source.fileName}</span>
                <span className="text-muted-foreground">{formatDateTime(source.createdAt)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {source.totalPrograms} ctkm
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={running}
                  onClick={() => reconcileRun(source.id)}
                >
                  Đối soát
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Hoặc tải lại file Excel gốc</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={running}
            onClick={() => inputRef.current?.click()}
          >
            Chọn file
          </Button>
          <span className="text-xs text-muted-foreground">Tối đa {MAX_UPLOAD_MB} MB.</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            // Reset so picking the same file twice fires change again.
            event.target.value = ''
            if (file) reconcileFile(file)
          }}
        />
      </section>

      {running || status ? (
        <Alert>
          {running ? <Loader2 aria-hidden className="size-4 animate-spin text-primary" /> : null}
          <AlertDescription>
            {running ? 'Đang đối soát... ' : ''}
            {status}
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}

