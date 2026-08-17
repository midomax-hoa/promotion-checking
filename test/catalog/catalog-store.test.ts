import { describe, expect, it } from 'vitest'
import { toVariantRows } from '@/lib/catalog/catalog-store'
import type { HaravanProduct } from '@/lib/haravan/types'

const SYNCED_AT = new Date('2026-08-17T10:00:00Z')

/** Shaped after a real dev-store response, blank/null SKUs included. */
const PRODUCT: HaravanProduct = {
  id: 1075675388,
  title: '1C Test Haravan',
  published_at: null,
  published_scope: null,
  not_allow_promotion: false,
  updated_at: '2026-08-11T02:52:12.63Z',
  variants: [
    {
      id: 1172575146,
      product_id: 1075675388,
      sku: null,
      barcode: null,
      title: 'Vàng xanh / 100',
      price: 0,
      compare_at_price: 0,
      inventory_quantity: -4,
    },
    {
      id: 1172575147,
      product_id: 1075675388,
      sku: '  ABC-1  ',
      barcode: '8938',
      title: 'Đỏ / 200',
      price: 250000,
      compare_at_price: null,
      inventory_quantity: null,
    },
  ],
}

describe('toVariantRows', () => {
  it('flattens variants and carries the parent product fields down', () => {
    const rows = toVariantRows(PRODUCT, SYNCED_AT)

    expect(rows).toHaveLength(2)
    expect(rows[0].variantId).toBe(1172575146n)
    expect(rows[0].productId).toBe(1075675388n)
    expect(rows[0].productTitle).toBe('1C Test Haravan')
    // published_at null means the product is not on sale yet -> rule B2.
    expect(rows[0].publishedAt).toBeNull()
    expect(rows[0].notAllowPromotion).toBe(false)
    expect(rows.every((r) => r.syncedAt === SYNCED_AT)).toBe(true)
  })

  it('stores a blank SKU as null so "no usable SKU" is one condition', () => {
    const rows = toVariantRows(PRODUCT, SYNCED_AT)

    expect(rows[0].sku).toBeNull()
    expect(rows[1].sku).toBe('ABC-1')
  })

  it('keeps a published date and a promotion block when the product has them', () => {
    const rows = toVariantRows(
      {
        ...PRODUCT,
        published_at: '2026-07-01T00:00:00Z',
        not_allow_promotion: true,
        published_scope: 'pos',
      },
      SYNCED_AT,
    )

    expect(rows[0].publishedAt?.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(rows[0].notAllowPromotion).toBe(true)
    expect(rows[0].publishedScope).toBe('pos')
  })
})
