import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CatalogSnapshotNote } from '@/components/check/catalog-freshness-alert'
import { FindingList } from '@/components/check/finding-row'
import { SeverityBadge } from '@/components/check/severity-badge'
import { DiffTable } from '@/components/reconcile/diff-table'
import { PageShell } from '@/components/shell/page-shell'
import { loadCheckRun, loadFindingPage } from '@/lib/check/finding-queries'
import { getAppConfig } from '@/lib/config/app-config'
import { loadReconcileMatches } from '@/lib/reconcile/reconcile-queries'
import { findRuleDefinition } from '@/lib/rules/rule-catalog'
import { parseFindingFilter } from '@/lib/check/finding-filter'

/**
 * Screen 6 - one reconciliation, re-openable at any time.
 *
 * The verdict is stated in a sentence before any table. "154 chương trình, 3
 * chỗ lệch" is the answer somebody came here for; the three-column comparison
 * below is the evidence for it.
 *
 * Everything is queried per request and rendered on the server - a run holds one
 * row per program and none of them belong in the browser.
 */

export const dynamic = 'force-dynamic'

const NUMBER = new Intl.NumberFormat('vi-VN')

function verdict(counts: { critical: number; danger: number; warn: number }) {
  if (counts.critical > 0) {
    return {
      headline: 'Import chưa đúng',
      detail: `${NUMBER.format(counts.critical)} chỗ lệch chắc chắn giữa file và Haravan. Xem bảng bên dưới rồi sửa trên Haravan.`,
      className: 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40',
    }
  }
  if (counts.danger > 0) {
    return {
      headline: 'Import xong nhưng có chỗ cần tự đối chiếu',
      detail: `${NUMBER.format(counts.danger)} chỗ công cụ không tự kết luận được, thường là do trùng tên chương trình.`,
      className: 'border-orange-300 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/40',
    }
  }
  if (counts.warn > 0) {
    return {
      headline: 'Import đúng',
      detail: `Còn ${NUMBER.format(counts.warn)} điểm nên ngó qua cho chắc.`,
      className: 'border-yellow-300 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/40',
    }
  }
  return {
    headline: 'Import đúng',
    detail: 'Mọi chương trình trong file đều khớp với Haravan.',
    className: 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40',
  }
}

export default async function ReconcileResultPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  const { runId } = await params
  const run = await loadCheckRun(runId)
  if (run == null) notFound()

  const config = await getAppConfig()
  const [matches, findings] = await Promise.all([
    loadReconcileMatches(runId),
    loadFindingPage(runId, parseFindingFilter({}), config.reportMaxRowsPerPage),
  ])

  const counts = {
    critical: run.countCritical,
    danger: run.countDanger,
    warn: run.countWarn,
  }
  const summary = verdict(counts)
  // Read back from the catalog so the screen never carries its own copy of a
  // threshold that an operator can change on the configuration screen.
  const percentTolerance = Number(findRuleDefinition('F2')?.defaultParams?.percentTolerance ?? 0.01)

  return (
    <PageShell
      title="Kết quả đối soát"
      description={run.fileName}
      width="full"
      actions={
        <Link href="/doi-soat" className="text-sm underline">
          ← Đối soát lần khác
        </Link>
      }
    >
      <section className={`flex flex-col gap-2 rounded-lg border p-4 ${summary.className}`}>
        <h2 className="text-xl font-semibold">{summary.headline}</h2>
        <p className="text-sm">{summary.detail}</p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <SeverityBadge severity="critical" count={counts.critical} variant="long" />
          <SeverityBadge severity="danger" count={counts.danger} variant="long" />
          <SeverityBadge severity="warn" count={counts.warn} variant="long" />
          <span className="text-xs text-muted-foreground tabular-nums">
            {NUMBER.format(run.totalPrograms)} chương trình trong file
          </span>
        </div>
      </section>

      <CatalogSnapshotNote catalogSyncedAt={run.catalogSyncedAt} />

      {findings.items.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Chỗ lệch phát hiện được</h2>
          <div className="overflow-x-auto rounded-lg border px-4">
            <FindingList findings={findings.items} showProgram />
          </div>
          {findings.total > findings.items.length ? (
            <p className="text-xs text-muted-foreground">
              Hiện {NUMBER.format(findings.items.length)} trên tổng {NUMBER.format(findings.total)}{' '}
              phát hiện.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">So từng chương trình</h2>
        <DiffTable
          rows={matches}
          options={{
            shopTimezoneOffsetMinutes: config.shopTimezoneOffsetMinutes,
            moneyToleranceVnd: config.moneyToleranceVnd,
            percentTolerance,
          }}
        />
      </section>
    </PageShell>
  )
}
