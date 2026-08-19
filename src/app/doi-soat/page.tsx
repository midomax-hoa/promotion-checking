import Link from 'next/link'
import { CatalogFreshnessAlert } from '@/components/check/catalog-freshness-alert'
import { ReconcileRunner } from '@/components/reconcile/reconcile-runner'
import { loadReconcileHistory, loadReconcileSources } from '@/lib/reconcile/reconcile-queries'
import { SeverityCount } from '@/components/check/severity-badge'
import { PageShell } from '@/components/shell/page-shell'
import { requireUser } from '@/lib/auth/current-user'

/**
 * Screen 5 - reconcile after import.
 *
 * The catalog warning comes first for the same reason it does on the check
 * screen, but with a different consequence: rule F5 counts the variants a
 * promotion covers by looking products up in the cache, so a stale cache makes
 * it stay silent rather than answer wrongly.
 */

export const dynamic = 'force-dynamic'

/** Enough recent files to pick from without turning the page into a second history. */
const SOURCE_LIMIT = 20
const HISTORY_LIMIT = 20

const NUMBER = new Intl.NumberFormat('vi-VN')

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(value)
}

export default async function ReconcilePage() {
  await requireUser()

  const [sources, history] = await Promise.all([
    loadReconcileSources(SOURCE_LIMIT),
    loadReconcileHistory(HISTORY_LIMIT),
  ])

  return (
    <PageShell
      title="Đối soát sau import"
      description="So từng chương trình trong file với chương trình thật trên Haravan, để biết lần import vừa rồi có đúng không."
      width="medium"
    >
      <CatalogFreshnessAlert />

      <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        Danh sách chương trình của Haravan cập nhật chậm vài giây sau khi tạo, nên công cụ kiểm
        hai lượt cách nhau một khoảng ngắn rồi mới kết luận. Vừa import xong mà đối soát liền thì
        nên chờ thêm ít phút cho chắc.
      </p>

      <ReconcileRunner sources={sources} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Các lần đối soát gần đây</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có lần đối soát nào.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            {history.map((run) => (
              <Link
                key={run.id}
                href={`/doi-soat/${run.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-sm last:border-b-0 hover:bg-muted/50"
              >
                <span className="min-w-40 flex-1 truncate font-medium">{run.fileName}</span>
                <span className="text-muted-foreground">{formatDateTime(run.createdAt)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {NUMBER.format(run.totalPrograms)} ctkm
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
      </section>
    </PageShell>
  )
}
