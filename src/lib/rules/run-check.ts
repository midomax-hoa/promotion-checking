/**
 * The one call the check screen makes: workbook in, findings out.
 *
 * Everything that touches the database or the network lives here so `engine.ts`
 * and the 31 rules stay pure and testable without a connection.
 *
 * The promotion list is fetched for rules D8 and E3, and its failure is
 * deliberately not fatal. A Haravan outage costs those two rules - recorded in
 * `skippedRules` - rather than the whole check, and it never becomes an empty
 * list, which the engine would let D8 read as "no name is taken".
 */

import { loadCatalogIndex } from '@/lib/catalog/catalog-index'
import { getAppConfig } from '@/lib/config/app-config'
import type { WorkbookReadResult } from '@/lib/excel/types'
import { tryFetchPromotionsForRules } from '@/lib/haravan/run-promotion-fetch'
import { mapPromotions } from '@/lib/reconcile/promotion-mapper'
import { runRules, type RunRulesResult } from './engine'
import { loadRuleConfigs } from './rule-config-store'
import type { HaravanPromotion } from './types'

export type CheckWorkbookOptions = {
  /** Pinned by tests; defaults to the wall clock. */
  now?: Date
  /** Pass a list (or null) to skip the fetch entirely - tests and reconciliation do. */
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

  // Mapped through the same code reconciliation uses, so D8 and E3 see exactly
  // the promotions the reconcile screen would show.
  const haravanPromotions =
    options.haravanPromotions !== undefined
      ? options.haravanPromotions
      : await (async () => {
          const raw = await tryFetchPromotionsForRules()
          return raw === null ? null : mapPromotions(raw, catalog)
        })()

  const result = runRules({
    workbook,
    catalog,
    haravanPromotions,
    now: options.now ?? new Date(),
    moneyToleranceVnd: appConfig.moneyToleranceVnd,
    configs,
  })

  return { ...result, catalogSyncedAt: catalog.syncedAt }
}
