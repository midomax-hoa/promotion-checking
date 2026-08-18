/**
 * Walks `GET /com/promotions.json` and returns every promotion the shop holds.
 *
 * Deliberately fetches all of them. Verified on 2026-08-18: the endpoint ignores
 * every query filter (`?status=disabled` still returns enabled promotions), and
 * there is no `count.json` to cross-check a total against. So narrowing by date
 * or status happens in memory, after the walk.
 *
 * The page size is learned from the first page rather than trusted from the
 * settings, the same way `catalog-sync.ts` does it: Haravan clamps `limit` on
 * the products endpoint, and a configured size larger than the real one would
 * make every full page look like the last one and truncate the walk.
 */

import type { HaravanClient } from './haravan-client'
import { PROMOTIONS_PATH, type PromotionListResponse, type RawHaravanPromotion } from './promotion-types'

/** Safety net against a misconfigured page size turning the loop into an infinite one. */
const MAX_PAGES = 200

export type PromotionFetchProgress = {
  page: number
  promotions: number
  done: boolean
}

export type PromotionFetchOptions = {
  pageSize: number
  onProgress?: (progress: PromotionFetchProgress) => void
}

/** Thrown when the walk stops early, so the operator learns which page failed. */
export class PromotionFetchError extends Error {
  constructor(
    readonly page: number,
    options?: { cause?: unknown },
  ) {
    super(`Không kéo được danh sách chương trình khuyến mãi, dừng ở trang ${page}.`, options)
    this.name = 'PromotionFetchError'
  }
}

export async function fetchAllPromotions(
  client: HaravanClient,
  options: PromotionFetchOptions,
): Promise<RawHaravanPromotion[]> {
  const { pageSize, onProgress } = options
  const collected: RawHaravanPromotion[] = []
  let effectivePageSize = pageSize
  let page = 1

  for (; page <= MAX_PAGES; page += 1) {
    let batch: RawHaravanPromotion[]
    try {
      const response = await client.get<PromotionListResponse>(PROMOTIONS_PATH, {
        limit: pageSize,
        page,
      })
      batch = response.promotions ?? []
    } catch (cause) {
      throw new PromotionFetchError(page, { cause })
    }

    // A short first page is ambiguous: the shop may hold only that many, or the
    // server may have clamped `limit` below what was asked for. It cannot be told
    // apart from one response, so the smaller value is assumed and one confirming
    // call is made. That costs a single extra request on a nearly empty shop and
    // avoids truncating the walk on a busy one, which is the trade worth taking.
    if (page === 1) effectivePageSize = Math.min(pageSize, Math.max(batch.length, 1))
    collected.push(...batch)

    const done = batch.length === 0 || batch.length < effectivePageSize
    onProgress?.({ page, promotions: collected.length, done })
    if (done) return collected
  }

  throw new PromotionFetchError(MAX_PAGES)
}
