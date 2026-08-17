import { describe, expect, it } from 'vitest'
import { buildCatalogIndex, findBySku } from '@/lib/catalog/catalog-index'

type Row = Parameters<typeof buildCatalogIndex>[0][number]

type RowInput = {
  variantId: number
  sku: string | null
  productId?: number
  productTitle?: string
  price?: number
}

function row(input: RowInput): Row {
  return {
    variantId: BigInt(input.variantId),
    productId: BigInt(input.productId ?? 1),
    sku: input.sku,
    productTitle: input.productTitle ?? 'Sản phẩm',
    variantTitle: null,
    price: input.price ?? 1000,
    publishedAt: null,
    notAllowPromotion: false,
  }
}

describe('buildCatalogIndex', () => {
  it('indexes by the normalised SKU so casing and spaces do not matter', () => {
    const index = buildCatalogIndex([row({ variantId: 1, sku: ' ABC-1 ' })], null)

    expect(findBySku(index, 'abc-1')).toHaveLength(1)
    expect(findBySku(index, 'ABC-1')).toHaveLength(1)
    expect(findBySku(index, ' abc-1 ')).toHaveLength(1)
    // The original spelling is kept for display.
    expect(findBySku(index, 'abc-1')[0].sku).toBe('ABC-1')
  })

  it('keeps every variant sharing a SKU - rule B5 needs all of them', () => {
    const index = buildCatalogIndex(
      [
        row({ variantId: 1, sku: 'DUP' }),
        row({ variantId: 2, sku: 'dup', productId: 2 }),
        row({ variantId: 3, sku: 'OTHER' }),
      ],
      null,
    )

    expect(findBySku(index, 'dup').map((e) => e.variantId)).toEqual([1n, 2n])
    expect(index.allSkus.sort()).toEqual(['dup', 'other'])
  })

  it('counts blank SKUs separately and never indexes them', () => {
    const index = buildCatalogIndex(
      [row({ variantId: 1, sku: null }), row({ variantId: 2, sku: '   ' }), row({ variantId: 3, sku: 'A' })],
      null,
    )

    expect(index.blankSkuCount).toBe(2)
    expect(index.variantCount).toBe(3)
    expect(index.bySku.size).toBe(1)
  })

  it('never matches a blank lookup, whatever the cache holds', () => {
    const index = buildCatalogIndex([row({ variantId: 1, sku: 'A' })], null)

    expect(findBySku(index, '')).toEqual([])
    expect(findBySku(index, '   ')).toEqual([])
    expect(findBySku(index, null)).toEqual([])
    expect(findBySku(index, undefined)).toEqual([])
  })

  it('carries the sync timestamp so screens can warn about a stale cache', () => {
    const syncedAt = new Date('2026-08-17T10:00:00Z')
    expect(buildCatalogIndex([], syncedAt).syncedAt).toBe(syncedAt)
  })
})
