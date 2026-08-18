import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Download } from 'lucide-react'
import { CatalogSnapshotNote } from '@/components/check/catalog-freshness-alert'
import { FindingFilters } from '@/components/check/finding-filters'
import { FindingTable } from '@/components/check/finding-table'
import { FindingList } from '@/components/check/finding-row'
import { ProgramTable } from '@/components/check/program-table'
import { SummaryCards } from '@/components/check/summary-cards'
import { PageShell } from '@/components/shell/page-shell'
import { buttonVariants } from '@/components/ui/button'
import { parseFindingFilter, type SearchParamsInput } from '@/lib/check/finding-filter'
import {
  loadCheckRun,
  loadFileLevelFindings,
  loadFindingPage,
  loadPrograms,
  loadRuleCodes,
} from '@/lib/check/finding-queries'
import { UPLOAD_EXPIRED_MESSAGE } from '@/lib/check/upload-storage'
import { getAppConfig } from '@/lib/config/app-config'

/**
 * Screen 2 - the result of one check run, re-openable at any time.
 *
 * Everything on it is queried per request with the filter taken from the URL.
 * The alternative - shipping the run to the browser and filtering there - would
 * mean posting thousands of findings to render a hundred.
 */

export const dynamic = 'force-dynamic'

export default async function CheckResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>
  searchParams: Promise<SearchParamsInput>
}) {
  const { runId } = await params
  const filter = parseFindingFilter(await searchParams)

  const run = await loadCheckRun(runId)
  if (run == null) notFound()

  const basePath = `/ket-qua/${runId}`
  const config = await getAppConfig()
  const [programs, ruleCodes, fileLevel, page] = await Promise.all([
    loadPrograms(runId),
    loadRuleCodes(runId),
    loadFileLevelFindings(runId, config.reportMaxRowsPerPage),
    loadFindingPage(runId, filter, config.reportMaxRowsPerPage),
  ])

  return (
    <PageShell
      title="Kết quả kiểm tra"
      width="full"
      actions={
        <>
          <Link href="/" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            ← Kiểm tra file khác
          </Link>
          <ExportButton runId={runId} available={run.storedFileName !== null} />
        </>
      }
    >
      <SummaryCards run={run} />
      <CatalogSnapshotNote catalogSyncedAt={run.catalogSyncedAt} />

      {fileLevel.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Vấn đề chung của file</h2>
          <div className="overflow-x-auto rounded-lg border px-4">
            <FindingList findings={fileLevel} />
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Theo chương trình khuyến mãi</h2>
        <ProgramTable runId={runId} basePath={basePath} programs={programs} filter={filter} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Chi tiết từng phát hiện</h2>
        <FindingFilters basePath={basePath} filter={filter} ruleCodes={ruleCodes} />
        <FindingTable basePath={basePath} filter={filter} page={page} />
      </section>
    </PageShell>
  )
}

/**
 * Disabled rather than hidden when the upload has been pruned: the button
 * vanishing looks like a bug, the explanation does not.
 */
function ExportButton({ runId, available }: { runId: string; available: boolean }) {
  if (!available) {
    return (
      <span className="rounded-md border px-3 py-1 text-sm text-muted-foreground">
        {UPLOAD_EXPIRED_MESSAGE}
      </span>
    )
  }
  return (
    <a href={`/api/check/${runId}/export`} className={buttonVariants({ size: 'lg' })}>
      <Download aria-hidden />
      Xuất Excel
    </a>
  )
}
