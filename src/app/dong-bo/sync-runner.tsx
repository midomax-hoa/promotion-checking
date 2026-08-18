'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { readNdjson } from '@/lib/ndjson-stream'

/** Six-figure product counts are unreadable without separators. */
const NUMBER = new Intl.NumberFormat('vi-VN')

/**
 * Runs a sync and shows progress while it happens.
 *
 * The route answers with NDJSON, so lines are read as they arrive instead of
 * waiting for the whole response - a full sync takes tens of seconds and the
 * screen would otherwise look frozen.
 */

type SyncEvent =
  | { type: 'start'; full: boolean }
  | {
      type: 'progress'
      page: number
      products: number
      variants: number
      expectedProducts: number | null
      done: boolean
    }
  | { type: 'done'; result: SyncDoneResult }
  | { type: 'error'; message: string; page: number | null }

type SyncDoneResult = {
  full: boolean
  pages: number
  products: number
  variants: number
  expectedProducts: number | null
  removed: number
  durationMs: number
}

export function SyncRunner() {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Extract<SyncEvent, { type: 'progress' }> | null>(null)
  const [result, setResult] = useState<SyncDoneResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function start(full: boolean) {
    setRunning(true)
    setProgress(null)
    setResult(null)
    setError(null)

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full }),
      })
      if (!response.ok || !response.body) {
        const detail = await response.json().catch(() => null)
        throw new Error(detail?.error ?? `Máy chủ trả lỗi ${response.status}.`)
      }
      for await (const event of readNdjson<SyncEvent>(response.body)) {
        if (event.type === 'progress') setProgress(event)
        if (event.type === 'done') setResult(event.result)
        if (event.type === 'error') setError(event.message)
      }
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không gọi được tuyến đồng bộ.')
    } finally {
      setRunning(false)
    }
  }

  const percent = toPercent(progress)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => start(false)} disabled={running}>
          {running ? <Loader2 aria-hidden className="animate-spin" /> : null}
          {running ? 'Đang đồng bộ...' : 'Đồng bộ tăng dần'}
        </Button>
        <Button variant="outline" onClick={() => start(true)} disabled={running}>
          Đồng bộ lại từ đầu
        </Button>
      </div>

      {progress ? (
        <Progress value={percent}>
          <ProgressLabel className="flex items-center gap-2">
            {running ? <Loader2 aria-hidden className="size-3.5 animate-spin text-primary" /> : null}
            <span className="tabular-nums">
              Trang {progress.page} · {NUMBER.format(progress.products)} sản phẩm ·{' '}
              {NUMBER.format(progress.variants)} biến thể
            </span>
          </ProgressLabel>
          <ProgressValue />
        </Progress>
      ) : null}

      {result ? (
        <Alert>
          <CheckCircle2 aria-hidden className="size-4 text-emerald-700 dark:text-emerald-400" />
          <AlertDescription>
            Xong: {NUMBER.format(result.products)} sản phẩm, {NUMBER.format(result.variants)} biến
            thể, {result.pages} trang, {(result.durationMs / 1000).toFixed(1)} giây
            {result.removed > 0
              ? `, dọn ${NUMBER.format(result.removed)} biến thể không còn trên Haravan`
              : ''}
            .
            {result.expectedProducts !== null && result.expectedProducts !== result.products
              ? ` Cảnh báo: Haravan báo có ${NUMBER.format(result.expectedProducts)} sản phẩm, chỉ kéo về được ${NUMBER.format(result.products)}.`
              : ''}
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

/** Indeterminate (null) until the total is known - an incremental run has none. */
function toPercent(progress: Extract<SyncEvent, { type: 'progress' }> | null): number | null {
  if (!progress) return null
  if (progress.done) return 100
  if (!progress.expectedProducts) return null
  return Math.min(100, Math.round((progress.products / progress.expectedProducts) * 100))
}

