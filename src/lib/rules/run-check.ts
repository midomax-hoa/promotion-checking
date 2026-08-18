/**
 * The one call the check screen makes: workbook in, findings out.
 *
 * Everything that touches the database lives here so `engine.ts` and the 31
 * rules stay pure and testable without a connection. Haravan promotions are not
 * fetched yet (phase 06 does that), so D8 and E3 are skipped and listed in
 * `skippedRules` rather than passing silently.
 */

import { loadCatalogIndex } from '@/lib/catalog/catalog-index'
import { getAppConfig } from '@/lib/config/app-config'
import type { WorkbookReadResult } from '@/lib/excel/types'
import { runRules, type RunRulesResult } from './engine'
import { loadRuleConfigs } from './rule-config-store'
import type { HaravanPromotion } from './types'

export type CheckWorkbookOptions = {
  /** Pinned by tests; defaults to the wall clock. */
  now?: Date
  /** null until phase 06 fetches them. */
  haravanPromotions?: HaravanPromotion[] | null
}

export async function checkWorkbook(
  workbook: WorkbookReadResult,
  options: CheckWorkbookOptions = {},
): Promise<RunRulesResult & { catalogSyncedAt: Date | null }> {
  const [catalog, configs, appConfig] = await Promise.all([
    loadCatalogIndex(),
    loadRuleConfigs(),
    getAppConfig(),
  ])

  const result = runRules({
    workbook,
    catalog,
    haravanPromotions: options.haravanPromotions ?? null,
    now: options.now ?? new Date(),
    moneyToleranceVnd: appConfig.moneyToleranceVnd,
    configs,
  })

  return { ...result, catalogSyncedAt: catalog.syncedAt }
}
