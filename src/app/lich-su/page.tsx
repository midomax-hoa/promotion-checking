import Link from 'next/link'
import { SeverityCount } from '@/components/check/severity-badge'
import { loadHistory } from '@/lib/check/check-run-history'

/**
 * Screen 4 - the runs already done.
 *
 * Exists so a result can be reopened without re-uploading, and so "we checked
 * that file on Monday and it was fine" is something the tool can answer rather
 * than something people argue about.
 */

export const dynamic = 'force-dynamic'

/** Enough to cover a busy month of checking without paginating a second screen. */
const HISTORY_LIMIT = 100

const NUMBER = new Intl.NumberFormat('vi-VN')

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(value)
}

export default async function HistoryPage() {
  const runs = await loadHistory(HISTORY_LIMIT)

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Lịch sử kiểm tra</h1>
        <p className="text-sm text-muted-foreground">
          {HISTORY_LIMIT} lần kiểm tra gần nhất, mới nhất lên đầu.
        </p>
      </header>

      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có lần kiểm tra nào.{' '}
          <Link href="/" className="underline">
            Tải file lên
          </Link>{' '}
          để bắt đầu.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          {runs.map((run) => (
            <Link
              key={run.id}
              href={`/ket-qua/${run.id}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-sm last:border-b-0 hover:bg-muted/50"
            >
              <span className="min-w-40 flex-1 font-medium">{run.fileName}</span>
              <span className="text-muted-foreground">{formatDateTime(run.createdAt)}</span>
              <span className="tabular-nums text-muted-foreground">
                {NUMBER.format(run.totalRows)} dòng · {NUMBER.format(run.totalPrograms)} ctkm
              </span>
              <span className="flex items-center gap-1">
                <SeverityCount severity="critical" count={run.countCritical} />
                <SeverityCount severity="danger" count={run.countDanger} />
                <SeverityCount severity="warn" count={run.countWarn} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
