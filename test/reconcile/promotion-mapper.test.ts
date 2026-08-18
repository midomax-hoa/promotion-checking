import { describe, expect, it } from 'vitest'
import { mapPromotion, resolveAttachment } from '@/lib/reconcile/promotion-mapper'
import { makeRawPromotion, makeReconcileCatalog, TWO_VARIANT_CATALOG } from './fixtures'

describe('mapPromotion', () => {
  it('reads the real kind from take_type, not from discount_type', () => {
    const promotion = mapPromotion(
      makeRawPromotion({ discount_type: 'product_amount', take_type: 'percentage', value: 50 }),
      TWO_VARIANT_CATALOG,
    )
    expect(promotion.takeType).toBe('percentage')
    expect(promotion.value).toBe(50)
  })

  it('treats anything other than enabled as not running', () => {
    expect(mapPromotion(makeRawPromotion({ status: 'enabled' }), TWO_VARIANT_CATALOG).active).toBe(
      true,
    )
    expect(mapPromotion(makeRawPromotion({ status: 'disabled' }), TWO_VARIANT_CATALOG).active).toBe(
      false,
    )
    expect(mapPromotion(makeRawPromotion({ status: null }), TWO_VARIANT_CATALOG).active).toBe(false)
  })

  it('keeps an unreadable value as null rather than zero', () => {
    const promotion = mapPromotion(makeRawPromotion({ value: null }), TWO_VARIANT_CATALOG)
    expect(promotion.value).toBeNull()
  })

  it('accepts an open-ended promotion', () => {
    expect(mapPromotion(makeRawPromotion({ ends_at: null }), TWO_VARIANT_CATALOG).endAt).toBeNull()
  })
})

describe('resolveAttachment', () => {
  it('counts variants listed one by one', () => {
    const result = resolveAttachment(
      makeRawPromotion({ entitled_variant_ids: [1, 2] }),
      TWO_VARIANT_CATALOG,
    )
    expect(result).toEqual({ skus: ['SKU1', 'SKU2'], variantCount: 2, byProduct: false })
  })

  /**
   * The case the dev store actually returned: no variant ids at all, eighteen
   * product ids. Counting only `entitled_variant_ids` would report zero.
   */
  it('expands whole products into their variants', () => {
    const catalog = makeReconcileCatalog([
      { variantId: 1, productId: 10, sku: 'SKU1' },
      { variantId: 2, productId: 10, sku: 'SKU2' },
      { variantId: 3, productId: 11, sku: 'SKU3' },
    ])
    const result = resolveAttachment(
      makeRawPromotion({ entitled_variant_ids: [], entitled_product_ids: [10, 11] }),
      catalog,
    )
    expect(result.variantCount).toBe(3)
    expect(result.byProduct).toBe(true)
    expect(result.skus.sort()).toEqual(['SKU1', 'SKU2', 'SKU3'])
  })

  it('counts a blank-SKU variant of an attached product', () => {
    const catalog = makeReconcileCatalog([
      { variantId: 1, productId: 10, sku: 'SKU1' },
      { variantId: 2, productId: 10, sku: null },
    ])
    const result = resolveAttachment(
      makeRawPromotion({ entitled_variant_ids: [], entitled_product_ids: [10] }),
      catalog,
    )
    // Attaching the product attaches both variants, SKU or no SKU.
    expect(result.variantCount).toBe(2)
    expect(result.skus).toEqual(['SKU1'])
  })

  it('refuses to count when a product is missing from the cache', () => {
    const result = resolveAttachment(
      makeRawPromotion({ entitled_variant_ids: [], entitled_product_ids: [10, 999] }),
      makeReconcileCatalog([{ variantId: 1, productId: 10, sku: 'SKU1' }]),
    )
    expect(result.variantCount).toBeNull()
  })

  it('refuses to count product attachments with no catalog at all', () => {
    const empty = makeReconcileCatalog([], null)
    const result = resolveAttachment(
      makeRawPromotion({ entitled_variant_ids: [], entitled_product_ids: [10] }),
      empty,
    )
    expect(result.variantCount).toBeNull()
  })

  it('still counts variant ids without a catalog - Haravan listed them itself', () => {
    const empty = makeReconcileCatalog([], null)
    const result = resolveAttachment(makeRawPromotion({ entitled_variant_ids: [7, 8, 9] }), empty)
    expect(result.variantCount).toBe(3)
    expect(result.skus).toEqual([])
  })

  it('counts a variant the cache has not seen yet', () => {
    const result = resolveAttachment(
      makeRawPromotion({ entitled_variant_ids: [1, 4242] }),
      TWO_VARIANT_CATALOG,
    )
    // The variant exists on Haravan; only its SKU is unknown here.
    expect(result.variantCount).toBe(2)
    expect(result.skus).toEqual(['SKU1'])
  })

  it('reports an empty attachment as unknown, not as zero', () => {
    const result = resolveAttachment(
      makeRawPromotion({ entitled_variant_ids: [], entitled_product_ids: [] }),
      TWO_VARIANT_CATALOG,
    )
    expect(result.variantCount).toBeNull()
  })
})
