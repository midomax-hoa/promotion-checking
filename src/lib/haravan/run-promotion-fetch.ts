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
    // Pacing between pages: this endpoint 429s well below the advertised
    // 4 req/s, so a full pull deliberately trades speed for never failing.
    delayMs: config.haravanPromotionDelayMs,
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
    // Concurrent checks share one walk. `/api/check` has no running-guard the
    // way `/api/reconcile` has, so two overlapping uploads used to start two
    // paced walks whose interleaved requests defeat the per-walk delay and
    // provoke the very 429s the pacing avoids.
    inFlightWalk ??= runPromotionFetch().finally(() => {
      inFlightWalk = null
    })
    return await inFlightWalk
  } catch (error) {
    console.error('[check] không kéo được danh sách chương trình, bỏ qua luật D8 và E3', error)
    return null
  }
}

/** Module-level on purpose: the sharing must span requests within the process. */
let inFlightWalk: Promise<RawHaravanPromotion[]> | null = null
