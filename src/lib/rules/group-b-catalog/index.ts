import type { Rule } from '../types'
import { b1SkuNotFound } from './b1-sku-not-found'
import { b2ProductNotPublished } from './b2-product-not-published'
import { b3ListPriceMismatch } from './b3-list-price-mismatch'
import { b4SkuPrefixMismatch } from './b4-sku-prefix-mismatch'
import { b5SkuMatchesManyVariants } from './b5-sku-matches-many-variants'
import { b6PromotionNotAllowed } from './b6-promotion-not-allowed'

/**
 * Group B - checked against the Haravan catalog cache.
 *
 * All but B4 declare `requires: ['catalog']`, so an empty or never-synced cache
 * skips them instead of reporting every SKU in the file as missing.
 */
export const GROUP_B_RULES: readonly Rule[] = [
  b1SkuNotFound,
  b2ProductNotPublished,
  b3ListPriceMismatch,
  b4SkuPrefixMismatch,
  b5SkuMatchesManyVariants,
  b6PromotionNotAllowed,
]
