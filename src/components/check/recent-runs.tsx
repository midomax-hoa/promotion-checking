/**
 * The last few checks, on the screen people land on.
 *
 * Coming back to this tool is usually about reopening a result, not about
 * uploading something new - and before this block the whole area under the
 * drop zone was empty while the way back sat behind a link to another screen.
 *
 * Reuses `loadHistory`, so this adds one query with an existing index on
 * `createdAt` rather than a new way of asking which runs exist.
 */

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { loadHistory } from '@/lib/check/check-run-history'
import { SeverityCount } from './severity-badge'

/** Enough to recognise the file somebody came back for; the rest is the history screen. */
const RECENT_LIMIT = 5

const NUMBER = new Intl.NumberFormat('vi-VN')

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(value)
}

export async function RecentRuns() {
  const runs = await loadHistory(RECENT_LIMIT)

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Kiểm tra gần đây</h2>
        {runs.length > 0 ? (
          <Link
            href="/lich-su"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Xem tất cả
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        ) : null}
      </div>

      {runs.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Chưa có lần kiểm tra nào. File đầu tiên tải lên sẽ xuất hiện ở đây.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          {runs.map((run) => (
            <Link
              key={run.id}
              href={`/ket-qua/${run.id}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/50"
            >
              <span className="min-w-0 flex-1 truncate font-medium">{run.fileName}</span>
              <span className="text-xs text-muted-foreground">{formatDateTime(run.createdAt)}</span>
              <span className="flex items-center gap-1">
                <SeverityCount severity="critical" count={run.countCritical} />
                <SeverityCount severity="danger" count={run.countDanger} />
                <SeverityCount severity="warn" count={run.countWarn} />
              </span>
              <span className="w-full text-xs text-muted-foreground tabular-nums sm:w-auto">
                {NUMBER.format(run.totalRows)} dòng
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
