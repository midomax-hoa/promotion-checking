/**
 * Turns a raw Haravan promotion into the shape the rules work with.
 *
 * The interesting part is counting attached variants, and it is interesting
 * because of something the dev store proved on 2026-08-18: a real promotion came
 * back with `entitled_variant_ids: []` and eighteen entries in
 * `entitled_product_ids`. Counting only the variant ids would have told the user
 * "your file has 18 rows, Haravan received 0" about a perfectly good import.
 *
 * Attaching a product attaches all of its variants, so both lists are resolved
 * through the catalog cache and added up. When the cache cannot answer - never
 * synced, or missing one of the products - the count is `null`, not a guess.
 * Rule F5 then says nothing at all, which is the only honest option: a wrong
 * "critical" here sends someone hunting for a problem that does not exist.
 */

import type { CatalogIndex } from '@/lib/catalog/catalog-index'
import {
  PROMOTION_STATUS_ENABLED,
  readTakeType,
  type RawHaravanPromotion,
} from '@/lib/haravan/promotion-types'
import { parseHaravanInstant } from './shop-time'
import type { ReconcilePromotion } from './types'

/** A catalog that was never synced answers every lookup with "absent", which is not an answer. */
function catalogUsable(catalog: CatalogIndex): boolean {
  return catalog.syncedAt !== null && catalog.variantCount > 0
}

type Attachment = {
  skus: string[]
  variantCount: number | null
  byProduct: boolean
}

export function resolveAttachment(raw: RawHaravanPromotion, catalog: CatalogIndex): Attachment {
  const variantIds = raw.entitled_variant_ids ?? []
  const productIds = raw.entitled_product_ids ?? []
  const byProduct = productIds.length > 0

  // Nothing declared at all: the promotion may cover everything, or use a
  // mechanism this tool does not read. Either way the count is unknown.
  if (variantIds.length === 0 && productIds.length === 0) {
    return { skus: [], variantCount: null, byProduct: false }
  }

  // Variant ids alone need no cache: Haravan lists them one by one.
  if (!byProduct && !catalogUsable(catalog)) {
    return { skus: [], variantCount: variantIds.length, byProduct: false }
  }
  if (byProduct && !catalogUsable(catalog)) {
    return { skus: [], variantCount: null, byProduct: true }
  }

  const skus = new Set<string>()
  let count = variantIds.length
  let resolvable = true

  for (const variantId of variantIds) {
    const entry = catalog.byVariantId.get(String(variantId))
    // A variant missing from the cache still counts - it exists on Haravan,
    // the cache is simply behind. Only its SKU is unknown.
    if (entry) skus.add(entry.sku)
  }

  for (const productId of productIds) {
    const key = String(productId)
    const variantCount = catalog.variantCountByProductId.get(key)
    if (variantCount == null) {
      // An unknown product means an unknown number of variants, and a partial
      // total would read as a real shortfall to rule F5.
      resolvable = false
      continue
    }
    count += variantCount
    for (const entry of catalog.byProductId.get(key) ?? []) skus.add(entry.sku)
  }

  return { skus: [...skus], variantCount: resolvable ? count : null, byProduct }
}

export function mapPromotion(
  raw: RawHaravanPromotion,
  catalog: CatalogIndex,
): ReconcilePromotion {
  const attachment = resolveAttachment(raw, catalog)
  return {
    id: String(raw.id),
    name: raw.name?.trim() ?? '',
    startAt: parseHaravanInstant(raw.starts_at),
    endAt: parseHaravanInstant(raw.ends_at),
    active: raw.status?.trim().toLowerCase() === PROMOTION_STATUS_ENABLED,
    skus: attachment.skus,
    takeType: readTakeType(raw.take_type),
    value: typeof raw.value === 'number' && Number.isFinite(raw.value) ? raw.value : null,
    usageLimit:
      typeof raw.usage_limit === 'number' && Number.isFinite(raw.usage_limit)
        ? raw.usage_limit
        : null,
    status: raw.status?.trim() ?? null,
    attachedVariantCount: attachment.variantCount,
    attachedByProduct: attachment.byProduct,
  }
}

export function mapPromotions(
  raws: readonly RawHaravanPromotion[],
  catalog: CatalogIndex,
): ReconcilePromotion[] {
  return raws.map((raw) => mapPromotion(raw, catalog))
}
