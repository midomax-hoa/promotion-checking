/**
 * Promotion response shapes, written from real calls against the dev store on
 * 2026-08-18. Evidence: `plans/reports/verification-260818-1046-haravan-promotions-api.md`.
 *
 * Four things the documentation gets wrong or omits, each of which would break
 * reconciliation silently:
 *   1. the path is `/com/promotions.json`; a bare `/promotions.json` answers 404
 *   2. there is no `promotions/count.json` - it answers 422
 *   3. query filters are ignored, `?status=disabled` still returns enabled ones,
 *      so every narrowing happens in memory after the fetch
 *   4. `discount_type` is `product_amount` with the real kind in `take_type`
 *
 * A percentage arrives as a whole number (`value: 50` = 50%), while the Excel
 * file stores the same thing as `0.5`. Nothing here converts; `promotion-mapper`
 * does it in one place.
 */

/** Ids come back as JSON numbers below 2^53, so they are exact. */
export type HaravanPromotionId = number

/** Verified values: `enabled`, `disabled`. Kept open - an unknown one must not crash a read. */
export type HaravanPromotionStatus = string

/** The real discount kind. `discount_type` is always `product_amount` and says nothing. */
export type HaravanTakeType = 'percentage' | 'fixed_amount'

export type RawHaravanPromotion = {
  id: HaravanPromotionId
  name: string | null
  /** UTC instant, e.g. `2026-07-22T08:11:00Z`. Never a local wall clock. */
  starts_at: string | null
  /** null = open ended, seen on the dev store. */
  ends_at: string | null
  /** Amount in dong for `fixed_amount`, whole percent (50 = 50%) for `percentage`. */
  value: number | null
  /** Always `product_amount` in practice; the useful field is `take_type`. */
  discount_type: string | null
  take_type: string | null
  status: HaravanPromotionStatus | null
  usage_limit: number | null
  /** Variants attached one by one. Empty when the promotion targets whole products. */
  entitled_variant_ids?: number[] | null
  /** Whole products attached. The dev store's only promotion uses this form. */
  entitled_product_ids?: number[] | null
  created_at?: string | null
  updated_at?: string | null
}

export type PromotionListResponse = { promotions: RawHaravanPromotion[] }

export const PROMOTIONS_PATH = '/com/promotions.json'

/** `enabled` is the only value seen for a live promotion; anything else counts as off. */
export const PROMOTION_STATUS_ENABLED = 'enabled'

/** Normalises the free-text `take_type` into the two kinds the rules understand. */
export function readTakeType(raw: string | null | undefined): HaravanTakeType | null {
  const value = raw?.trim().toLowerCase()
  if (value === 'percentage') return 'percentage'
  if (value === 'fixed_amount') return 'fixed_amount'
  return null
}
