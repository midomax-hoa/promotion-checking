import { describe, expect, it } from 'vitest'
import { mapColumns } from '@/lib/excel/column-mapper'

/** The header row of `promotion.t8.xlsx`, cell shapes included. */
const REAL_HEADER = [
  'Mã',
  'Mã hiệu',
  'Mặt hàng',
  'Đặc tính',
  'Bộ đóng gói',
  'Giá niêm yết',
  { richText: [{ text: 'Số dư\n' }, { text: '(Để trống nếu không giới hạn)' }] },
  'Giá sau giảm',
  'Số tiền giảm',
  'Phần trăm giảm',
  'Kiểu ctkm',
  'Thời gian bắt đầu chương trình',
  'Thời gian kết thúc chương trình',
  'Tên ctkm',
  null, // the unnamed trailing column, present in both real sheets
]

describe('mapColumns - the real header row', () => {
  const mapping = mapColumns(REAL_HEADER)

  it('binds every field to its 1-based column', () => {
    expect(mapping.columns).toEqual({
      productCode: 1,
      sku: 2,
      productName: 3,
      variantName: 4,
      unit: 5,
      listPrice: 6,
      usageLimit: 7,
      priceAfter: 8,
      discountAmount: 9,
      discountPercent: 10,
      discountTypeRaw: 11,
      startAt: 12,
      endAt: 13,
      programName: 14,
    })
  })

  it('matches the rich-text Số dư header despite its embedded newline', () => {
    expect(mapping.columns.usageLimit).toBe(7)
  })

  it('matches the long date headers on a fragment', () => {
    expect(mapping.matchedHeaders.startAt).toBe('Thời gian bắt đầu chương trình')
    expect(mapping.matchedHeaders.endAt).toBe('Thời gian kết thúc chương trình')
  })

  it('reports headers as typed, not as normalised', () => {
    expect(mapping.matchedHeaders.sku).toBe('Mã hiệu')
  })

  it('finds nothing missing', () => {
    expect(mapping.missingRequired).toEqual([])
  })
})

describe('mapColumns - Mã must not swallow Mã hiệu', () => {
  it('keeps them apart in file order', () => {
    const mapping = mapColumns(['Mã', 'Mã hiệu'])
    expect([mapping.columns.productCode, mapping.columns.sku]).toEqual([1, 2])
  })

  it('keeps them apart when Mã hiệu comes first', () => {
    const mapping = mapColumns(['Mã hiệu', 'Mã'])
    expect([mapping.columns.productCode, mapping.columns.sku]).toEqual([2, 1])
  })

  it('gives the longer keyword the column when both headers are padded', () => {
    const mapping = mapColumns(['Mã SP', 'Mã hiệu SP'])
    expect([mapping.columns.productCode, mapping.columns.sku]).toEqual([1, 2])
  })

  it('leaves Mã unbound rather than stealing Mã hiệu when Mã is absent', () => {
    const mapping = mapColumns(['Mã hiệu', 'Kiểu ctkm', 'Tên ctkm'])
    expect(mapping.columns.sku).toBe(1)
    expect(mapping.columns.productCode).toBeUndefined()
  })
})

describe('mapColumns - resilience', () => {
  it('does not care about column order or case', () => {
    const mapping = mapColumns(['TÊN CTKM', 'kiểu ctkm', 'mã hiệu'])
    expect(mapping.columns).toMatchObject({ programName: 1, discountTypeRaw: 2, sku: 3 })
    expect(mapping.missingRequired).toEqual([])
  })

  it('ignores unnamed and unknown columns', () => {
    const mapping = mapColumns([null, 'Ghi chú', 'Mã hiệu', '', 'Kiểu ctkm', 'Tên ctkm'])
    expect(mapping.columns).toMatchObject({ sku: 3, discountTypeRaw: 5, programName: 6 })
  })

  it('lists the required columns a notes sheet lacks instead of throwing', () => {
    const mapping = mapColumns(['Hướng dẫn sử dụng'])
    expect(mapping.missingRequired).toEqual(['sku', 'discountTypeRaw', 'programName'])
  })

  it('handles a sheet with no header at all', () => {
    const mapping = mapColumns([])
    expect(mapping.columns).toEqual({})
    expect(mapping.missingRequired).toHaveLength(3)
  })
})
