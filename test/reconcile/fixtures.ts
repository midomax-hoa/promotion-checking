/**
 * Builders for the reconciliation tests.
 *
 * The raw promotion builder mirrors the JSON a real call returned on
 * 2026-08-18, including the awkward parts - `discount_type: 'product_amount'`
 * carrying no information, and the split between `entitled_variant_ids` and
 * `entitled_product_ids`.
 */

import { buildCatalogIndex, type CatalogIndex } from '@/lib/catalog/catalog-index'
import type { RawHaravanPromotion } from '@/lib/haravan/promotion-types'
import { mergeRuleConfigs } from '@/lib/rules/rule-config-store'
import type { RuleConfigInput } from '@/lib/rules/rule-config-store'
import { mapPromotion } from '@/lib/reconcile/promotion-mapper'
import type { ReconcilePromotion } from '@/lib/reconcile/types'

export const VN_OFFSET_MINUTES = 420

export function makeRawPromotion(
  overrides: Partial<RawHaravanPromotion> = {},
): RawHaravanPromotion {
  return {
    id: 1083826310,
    name: '2608GST10K',
    // 01/08/2026 00:00 Vietnam time, expressed the way Haravan expresses it.
    starts_at: '2026-07-31T17:00:00Z',
    ends_at: '2026-08-30T17:00:00Z',
    value: 10_000,
    discount_type: 'product_amount',
    take_type: 'fixed_amount',
    status: 'enabled',
    usage_limit: null,
    entitled_variant_ids: [1, 2],
    entitled_product_ids: [],
    ...overrides,
  }
}

type CatalogVariant = {
  variantId: number
  productId: number
  sku: string | null
}

export function makeReconcileCatalog(
  variants: CatalogVariant[],
  syncedAt: Date | null = new Date(2026, 7, 18),
): CatalogIndex {
  return buildCatalogIndex(
    variants.map((variant) => ({
      variantId: BigInt(variant.variantId),
      productId: BigInt(variant.productId),
      sku: variant.sku,
      productTitle: 'Áo thun',
      variantTitle: null,
      price: 100_000,
      publishedAt: new Date(2026, 0, 1),
      notAllowPromotion: false,
    })),
    syncedAt,
  )
}

/** Two variants, one per product, matching the default raw promotion above. */
export const TWO_VARIANT_CATALOG = makeReconcileCatalog([
  { variantId: 1, productId: 10, sku: 'SKU1' },
  { variantId: 2, productId: 11, sku: 'SKU2' },
])

export function makeReconcilePromotion(
  overrides: Partial<RawHaravanPromotion> = {},
  catalog: CatalogIndex = TWO_VARIANT_CATALOG,
): ReconcilePromotion {
  return mapPromotion(makeRawPromotion(overrides), catalog)
}

/** Catalog defaults for every rule, so a test only states what it is about. */
export function reconcileConfigs(
  overrides: Partial<Record<string, Partial<RuleConfigInput>>> = {},
): RuleConfigInput[] {
  return mergeRuleConfigs([]).map((config) => ({ ...config, ...overrides[config.code] }))
}
