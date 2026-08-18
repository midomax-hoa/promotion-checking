/**
 * The whole reconciliation in one call: a file (or a previous run) in, a saved
 * run id out.
 *
 * Wires read workbook -> fetch twice -> run group F -> persist. Kept apart from
 * `reconcile-engine.ts` so the two-pass logic stays testable without a database
 * or a network.
 *
 * Reusing a previous run rather than re-uploading is the normal path: the file
 * was already checked before import, and reconciling afterwards should not mean
 * hunting for it again. When the stored copy has been pruned, that is said
 * plainly instead of silently reconciling against something else.
 */

import { loadCatalogIndex } from '@/lib/catalog/catalog-index'
import { attachStoredFile, saveCheckRun } from '@/lib/check/check-run-store'
import { buildStoredFileName, readUploadedFile, saveUploadedFile } from '@/lib/check/upload-storage'
import { getAppConfig } from '@/lib/config/app-config'
import { prisma } from '@/lib/db/prisma'
import { readPromotionWorkbook } from '@/lib/excel/promotion-workbook'
import { runPromotionFetch } from '@/lib/haravan/run-promotion-fetch'
import type { PromotionFetchProgress } from '@/lib/haravan/promotion-fetcher'
import { loadRuleConfigs } from '@/lib/rules/rule-config-store'
import { reconcile, type ReconcileProgress, type ReconcileResult } from './reconcile-engine'
import { buildReconcileMatchRows } from './reconcile-match-rows'

/** Raised when the run the user picked has no file left to reconcile. */
export class SourceFileMissingError extends Error {
  constructor() {
    super('Không còn file gốc của lần kiểm tra đó. Tải lại file Excel để đối soát.')
    this.name = 'SourceFileMissingError'
  }
}

export type ReconcileSource =
  | { kind: 'upload'; bytes: Uint8Array; fileName: string }
  | { kind: 'previous-run'; runId: string }

export type RunReconcileProgress =
  | ({ type: 'fetch' } & PromotionFetchProgress)
  | ({ type: 'reconcile' } & ReconcileProgress)

export type RunReconcileResult = {
  runId: string
  passesAgreed: boolean
  passesRun: 1 | 2
  counts: ReconcileResult['counts']
  matchCount: number
}

async function readSource(
  source: ReconcileSource,
): Promise<{ bytes: Uint8Array; fileName: string }> {
  if (source.kind === 'upload') return { bytes: source.bytes, fileName: source.fileName }

  const run = await prisma.checkRun.findUnique({
    where: { id: source.runId },
    select: { fileName: true, storedFileName: true },
  })
  if (run == null) throw new SourceFileMissingError()
  const buffer = await readUploadedFile(run.storedFileName)
  if (buffer == null) throw new SourceFileMissingError()
  return { bytes: new Uint8Array(buffer), fileName: run.fileName }
}

export async function runReconcile(
  source: ReconcileSource,
  onProgress?: (progress: RunReconcileProgress) => void,
): Promise<RunReconcileResult> {
  const { bytes, fileName } = await readSource(source)
  const workbook = await readPromotionWorkbook(bytes, fileName)

  const [catalog, configs, appConfig] = await Promise.all([
    loadCatalogIndex(),
    loadRuleConfigs(),
    getAppConfig(),
  ])

  const result = await reconcile(
    workbook,
    {
      recheckDelayMs: appConfig.reconcileRecheckDelayMs,
      shopTimezoneOffsetMinutes: appConfig.shopTimezoneOffsetMinutes,
      moneyToleranceVnd: appConfig.moneyToleranceVnd,
      configs,
    },
    {
      catalog,
      fetchPromotions: () =>
        runPromotionFetch((progress) => onProgress?.({ type: 'fetch', ...progress })),
      onProgress: (progress) => onProgress?.({ type: 'reconcile', ...progress }),
    },
  )

  const runId = await saveCheckRun({
    workbook,
    result: {
      findings: result.findings,
      counts: result.counts,
      skippedRules: result.skippedRules,
    },
    catalogSyncedAt: catalog.syncedAt,
    storedFileName: null,
    mode: 'reconcile',
    matches: buildReconcileMatchRows(result.matches),
  })

  // Only an upload brings new bytes worth keeping; a previous run already has
  // its own copy on disk and re-saving it would double the retention cost.
  if (source.kind === 'upload') {
    const storedFileName = buildStoredFileName(runId, fileName)
    try {
      await saveUploadedFile(storedFileName, bytes)
      await attachStoredFile(runId, storedFileName)
    } catch (error) {
      // Logged, never thrown: the reconciliation succeeded and must be shown.
      console.error('[reconcile] không lưu được file gốc', error)
    }
  }

  return {
    runId,
    passesAgreed: result.passesAgreed,
    passesRun: result.passesRun,
    counts: result.counts,
    matchCount: result.matches.length,
  }
}
