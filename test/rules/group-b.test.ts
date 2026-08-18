import { describe, expect, it } from 'vitest'
import { b1SkuNotFound } from '@/lib/rules/group-b-catalog/b1-sku-not-found'
import { b2ProductNotPublished } from '@/lib/rules/group-b-catalog/b2-product-not-published'
import { b3ListPriceMismatch } from '@/lib/rules/group-b-catalog/b3-list-price-mismatch'
import { b4SkuPrefixMismatch } from '@/lib/rules/group-b-catalog/b4-sku-prefix-mismatch'
import { b5SkuMatchesManyVariants } from '@/lib/rules/group-b-catalog/b5-sku-matches-many-variants'
import { b6PromotionNotAllowed } from '@/lib/rules/group-b-catalog/b6-promotion-not-allowed'
import { makeCatalog, makeRow, runRule } from './fixtures'

const row = (sku: string, overrides = {}) =>
  makeRow({ sku, skuNormalized: sku.toLowerCase(), productCode: 'KMAP231728F', ...overrides })

describe('B1 - SKU not on Haravan', () => {
  it('reports the silent drop and suggests the nearest SKU', () => {
    const findings = runRule(b1SkuNotFound, {
      rows: [row('KMAP231728F.XXL')],
      catalog: makeCatalog([{ sku: 'KMAP231728F.XL' }]),
    })

    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('không có trên Haravan')
    expect(findings[0].message).toContain('lặng lẽ bỏ qua')
    expect(findings[0].suggestion).toContain('"kmap231728f.xl"')
  })

  it('falls back to generic advice when nothing is close', () => {
    const findings = runRule(b1SkuNotFound, {
      rows: [row('ZZZ999.XL')],
      catalog: makeCatalog([{ sku: 'KMAP231728F.XL' }]),
    })
    expect(findings[0].suggestion).toContain('đồng bộ lại danh mục')
  })

  it('says nothing for a SKU that exists', () => {
    expect(
      runRule(b1SkuNotFound, {
        rows: [row('KMAP231728F.XL')],
        catalog: makeCatalog([{ sku: 'KMAP231728F.XL' }]),
      }),
    ).toHaveLength(0)
  })

  it('leaves blank SKUs to A4', () => {
    const rows = [makeRow({ sku: null, skuNormalized: null })]
    expect(runRule(b1SkuNotFound, { rows, catalog: makeCatalog([{ sku: 'X' }]) })).toHaveLength(0)
  })

  it('still reports the finding when the suggestion budget runs out, and says so', () => {
    const findings = runRule(b1SkuNotFound, {
      rows: [row('KMAP231728F.XXL')],
      catalog: makeCatalog([{ sku: 'KMAP231728F.XL' }]),
      params: { suggestMaxComparisons: 0 },
    })

    expect(findings).toHaveLength(1)
    expect(findings[0].suggestion).toContain('dừng gợi ý mã gần giống')
    expect(findings[0].suggestion).toContain('đồng bộ lại')
  })
})

describe('B2 - product not published', () => {
  it('reports a SKU whose variants are all unpublished', () => {
    const findings = runRule(b2ProductNotPublished, {
      rows: [row('A1')],
      catalog: makeCatalog([{ sku: 'A1', publishedAt: null, productTitle: 'Áo bóng bàn' }]),
    })
    expect(findings[0].message).toContain('"Áo bóng bàn"')
    expect(findings[0].message).toContain('chưa đăng bán')
  })

  it('stays quiet when at least one variant is on sale', () => {
    const findings = runRule(b2ProductNotPublished, {
      rows: [row('A1')],
      catalog: makeCatalog([
        { sku: 'A1', publishedAt: null },
        { sku: 'A1', publishedAt: new Date(2026, 0, 1) },
      ]),
    })
    expect(findings).toHaveLength(0)
  })
})

describe('B3 - list price mismatch', () => {
  it('spells out both prices and the real final price', () => {
    const findings = runRule(b3ListPriceMismatch, {
      rows: [row('A1', { listPrice: 289_000, discountAmount: 130_000, priceAfter: 159_000 })],
      catalog: makeCatalog([{ sku: 'A1', price: 299_000 }]),
    })

    expect(findings[0].message).toContain('file ghi giá niêm yết 289.000đ')
    expect(findings[0].message).toContain('Haravan đang để 299.000đ')
    expect(findings[0].suggestion).toContain('169.000đ')
  })

  it('accepts a match on any of several variants', () => {
    const findings = runRule(b3ListPriceMismatch, {
      rows: [row('A1', { listPrice: 289_000 })],
      catalog: makeCatalog([{ sku: 'A1', price: 299_000 }, { sku: 'A1', price: 289_000 }]),
    })
    expect(findings).toHaveLength(0)
  })
})

describe('B4 - SKU does not start with the product code', () => {
  it('reports the mismatch', () => {
    const findings = runRule(b4SkuPrefixMismatch, {
      rows: [makeRow({ productCode: 'KMAP231728F', sku: 'KMTF240645.44' })],
    })
    expect(findings[0].message).toContain('không bắt đầu bằng mã sản phẩm')
  })

  it('ignores case and accepts the house convention', () => {
    const findings = runRule(b4SkuPrefixMismatch, {
      rows: [makeRow({ productCode: 'kmap231728f', sku: 'KMAP231728F.L' })],
    })
    expect(findings).toHaveLength(0)
  })

  it('needs no catalog, so it still runs on an empty cache', () => {
    expect(b4SkuPrefixMismatch.requires).toBeUndefined()
  })
})

describe('B5 - SKU matches several variants', () => {
  it('lists the ambiguous variants', () => {
    const findings = runRule(b5SkuMatchesManyVariants, {
      rows: [row('A1')],
      catalog: makeCatalog([
        { sku: 'A1', productTitle: 'Áo A', variantTitle: 'Đỏ / L', price: 100_000 },
        { sku: 'A1', productTitle: 'Áo B', variantTitle: 'Xanh / M', price: 120_000 },
      ]),
    })

    expect(findings[0].message).toContain('khớp 2 biến thể')
    expect(findings[0].message).toContain('"Áo A - Đỏ / L" (100.000đ)')
  })

  it('says nothing for a unique SKU', () => {
    expect(
      runRule(b5SkuMatchesManyVariants, { rows: [row('A1')], catalog: makeCatalog([{ sku: 'A1' }]) }),
    ).toHaveLength(0)
  })
})

describe('B6 - product excluded from promotions', () => {
  it('names the product carrying the flag', () => {
    const findings = runRule(b6PromotionNotAllowed, {
      rows: [row('A1')],
      catalog: makeCatalog([{ sku: 'A1', notAllowPromotion: true, productTitle: 'Vợt Kamito' }]),
    })
    expect(findings[0].message).toContain('"Vợt Kamito"')
    expect(findings[0].message).toContain('cấm khuyến mãi')
  })

  it('says nothing when the flag is off', () => {
    expect(
      runRule(b6PromotionNotAllowed, { rows: [row('A1')], catalog: makeCatalog([{ sku: 'A1' }]) }),
    ).toHaveLength(0)
  })
})
