/**
 * The one call the check screen makes: workbook in, findings out.
 *
 * Everything that touches the database or the network lives here so `engine.ts`
 * and the 31 rules stay pure and testable without a connection.
 *
 * The promotion list feeds rules D8 and E3 only, and fetching it is gated twice
 * before a single request goes out:
 *
 *   1. `check.fetch_promotions` must be on. It ships on - measured against the
 *      real shop on 2026-08-19, the walk is 10 requests and about a minute at
 *      the paced `haravan.promotion_delay_ms` cadence (slow on purpose: the
 *      endpoint throttles harder than its headers advertise, and a paced walk
 *      never dies on a 429)
 *      - but the endpoint cannot be narrowed (`?name=` and `?query=` are
 *      ignored, so there is no way to ask only about the file's programs), and
 *      a shop that grows past the page cap would pay the whole walk on every
 *      upload. The switch is what lets that be turned off without editing code.
 *   2. At least one rule that needs the list must be enabled. Fetching for a
 *      rule the operator switched off is pure waste.
 *
 * Failure stays deliberately non-fatal. A Haravan outage costs those two rules -
 * recorded in `skippedRules` - rather than the whole check, and it never becomes
 * an empty list, which the engine would let D8 read as "no name is taken".
 */

import type { CatalogIndex } from '@/lib/catalog/catalog-index'
import { loadCatalogIndex } from '@/lib/catalog/catalog-index'
import { getAppConfig } from '@/lib/config/app-config'
import type { WorkbookReadResult } from '@/lib/excel/types'
import { tryFetchPromotionsForRules } from '@/lib/haravan/run-promotion-fetch'
import { mapPromotions } from '@/lib/reconcile/promotion-mapper'
import { runRules, type RunRulesResult } from './engine'
import { RULES } from './registry'
import { loadRuleConfigs, type RuleConfigInput } from './rule-config-store'
import type { HaravanPromotion } from './types'

/**
 * Rule codes that cannot run without the promotion list, read off the registry
 * rather than spelled out here - a rule added later declaring the same
 * requirement is picked up without anyone remembering to edit this file.
 */
const PROMOTION_RULE_CODES = new Set(
  RULES.filter((rule) => rule.requires?.includes('haravan-promotions')).map((rule) => rule.code),
)

export type CheckWorkbookOptions = {
  /** Pinned by tests; defaults to the wall clock. */
  now?: Date
  /** Pass a list (or null) to skip the fetch entirely - tests and reconciliation do. */
  haravanPromotions?: HaravanPromotion[] | null
}

/** Pure, so the two gates can be asserted without a database or a network. */
export function shouldFetchPromotions(
  configs: readonly RuleConfigInput[],
  enabled: boolean,
): boolean {
  if (!enabled) return false
  return configs.some((config) => config.enabled && PROMOTION_RULE_CODES.has(config.code))
}

/**
 * Null - meaning "not loaded", so the engine skips D8 and E3 - whenever the
 * setting is off, no rule wants the list, or the fetch failed.
 */
async function loadPromotionsForRules(
  catalog: CatalogIndex,
  configs: readonly RuleConfigInput[],
  enabled: boolean,
): Promise<HaravanPromotion[] | null> {
  if (!shouldFetchPromotions(configs, enabled)) return null

  const raw = await tryFetchPromotionsForRules()
  return raw === null ? null : mapPromotions(raw, catalog)
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
      : await loadPromotionsForRules(catalog, configs, appConfig.checkFetchPromotions)

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
