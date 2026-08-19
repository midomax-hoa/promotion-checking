/**
 * Wires the real client and the database settings to the promotion walk.
 * Kept apart from `promotion-fetcher` so the paging logic stays testable
 * without a network.
 */

import { getAppConfig } from '@/lib/config/app-config'
import { createHaravanClient } from './haravan-client'
import { fetchAllPromotions, type PromotionFetchProgress } from './promotion-fetcher'
import type { RawHaravanPromotion } from './promotion-types'

export async function runPromotionFetch(
  onProgress?: (progress: PromotionFetchProgress) => void,
): Promise<RawHaravanPromotion[]> {
  const config = await getAppConfig()
  const client = await createHaravanClient()
  // Its own page size, not `haravanPageSize`: that one is capped at 50 for the
  // products endpoint, while this one honours 250 (measured 2026-08-19). At
  // 2.290 promotions that is 10 requests instead of 46.
  return fetchAllPromotions(client, {
    pageSize: config.haravanPromotionPageSize,
    maxPages: config.haravanPromotionMaxPages,
    onProgress,
  })
}

/**
 * The list as the checking rules D8 and E3 want it, or `null` when it could not
 * be fetched.
 *
 * Null rather than an empty array, and never a throw: the engine treats null as
 * "not loaded" and skips those two rules, while an empty array would let D8
 * conclude that no program name is taken and E3 that nothing overlaps. A
 * Haravan outage must cost two rules, not the whole check, and it must never
 * turn into a confident all-clear.
 */
export async function tryFetchPromotionsForRules(): Promise<RawHaravanPromotion[] | null> {
  try {
    return await runPromotionFetch()
  } catch (error) {
    console.error('[check] không kéo được danh sách chương trình, bỏ qua luật D8 và E3', error)
    return null
  }
}
