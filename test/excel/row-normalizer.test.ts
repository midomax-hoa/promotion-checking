import { describe, expect, it } from 'vitest'
import { mapColumns } from '@/lib/excel/column-mapper'
import type { RawRow } from '@/lib/excel/excel-reader'
import { isEmptyRow, normalizeRow, parseDiscountType } from '@/lib/excel/row-normalizer'

const HEADER = [
  'Mã',
  'Mã hiệu',
  'Mặt hàng',
  'Đặc tính',
  'Bộ đóng gói',
  'Giá niêm yết',
  'Số dư',
  'Giá sau giảm',
  'Số tiền giảm',
  'Phần trăm giảm',
  'Kiểu ctkm',
  'Thời gian bắt đầu chương trình',
  'Thời gian kết thúc chương trình',
  'Tên ctkm',
]
const MAPPING = mapColumns(HEADER)

/** Row 2 of the real sheet "Key", with the formula cells exactly as exceljs emits them. */
const REAL_ROW: RawRow = {
  rowNumber: 2,
  cells: [
    'KMAP231728F',
    'KMAP231728F.L',
    'Áo bóng bàn Kamito Champion nữ',
    'KMAP231728F Xanh cổ vịt size L',
    'Chiếc',
    289000,
    null,
    159000,
    { formula: 'F2-H2', result: 130000 },
    null,
    'Giảm giá theo số tiền',
    new Date('2026-08-01T00:00:00.000Z'),
    new Date('2026-08-31T00:00:00.000Z'),
    { formula: 'IF(K2=...)', result: '2608GST130K' },
    null,
  ],
}

const rowWith = (overrides: Record<number, unknown>): RawRow => {
  const cells = [...REAL_ROW.cells]
  for (const [index, value] of Object.entries(overrides)) cells[Number(index)] = value
  return { rowNumber: 7, cells }
}

describe('normalizeRow - a real row', () => {
  const row = normalizeRow('Key', REAL_ROW, MAPPING)

  it('carries the sheet name and the true Excel row number', () => {
    expect(row.sheetName).toBe('Key')
    expect(row.rowNumber).toBe(2)
  })

  it('reads text fields', () => {
    expect(row.productCode).toBe('KMAP231728F')
    expect(row.sku).toBe('KMAP231728F.L')
    expect(row.skuNormalized).toBe('kmap231728f.l')
    expect(row.unit).toBe('Chiếc')
  })

  it('reads the discount amount through its formula cell', () => {
    expect(row.discountAmount).toBe(130000)
    expect(row.listPrice).toBe(289000)
    expect(row.priceAfter).toBe(159000)
  })

  it('reads the program name through its formula cell - grouping depends on it', () => {
    expect(row.programName).toBe('2608GST130K')
  })

  it('reads the dates as local calendar days', () => {
    expect([row.startAt?.getFullYear(), row.startAt?.getMonth(), row.startAt?.getDate()]).toEqual([
      2026, 7, 1,
    ])
    expect(row.endAt?.getDate()).toBe(31)
  })

  it('maps the discount type and keeps the original wording', () => {
    expect(row.discountTypeRaw).toBe('Giảm giá theo số tiền')
    expect(row.discountType).toBe('fixed_amount')
  })

  it('leaves an empty Số dư null - blank means no limit, not zero', () => {
    expect(row.usageLimit).toBeNull()
    expect(row.issues.usageLimit).toBeUndefined()
  })

  it('records no issues', () => {
    expect(row.issues).toEqual({})
  })
})

describe('normalizeRow - issues instead of silent defaults', () => {
  it('flags an unreadable date and leaves the field null', () => {
    const row = normalizeRow('Key', rowWith({ 11: 'tháng 8 nha' }), MAPPING)
    expect(row.startAt).toBeNull()
    expect(row.issues.startAt).toBe('unparsable-date')
  })

  it('tells a blank date apart from a broken one', () => {
    const row = normalizeRow('Key', rowWith({ 11: null }), MAPPING)
    expect(row.issues.startAt).toBe('missing')
  })

  it('flags an unreadable amount', () => {
    const row = normalizeRow('Key', rowWith({ 8: 'khoảng 130k' }), MAPPING)
    expect(row.discountAmount).toBeNull()
    expect(row.issues.discountAmount).toBe('unparsable-number')
  })

  it('keeps a 0đ discount as 0 with no issue - rule C2 is what reports it', () => {
    const row = normalizeRow('Key', rowWith({ 8: { formula: 'F7-H7', result: 0 } }), MAPPING)
    expect(row.discountAmount).toBe(0)
    expect(row.issues.discountAmount).toBeUndefined()
  })

  it('flags a blank SKU', () => {
    const row = normalizeRow('Key', rowWith({ 1: '   ' }), MAPPING)
    expect(row.sku).toBeNull()
    expect(row.skuNormalized).toBeNull()
    expect(row.issues.sku).toBe('missing')
  })

  it('flags an unrecognised discount type but keeps the text for the message', () => {
    const row = normalizeRow('Key', rowWith({ 10: 'Mua 1 tặng 1' }), MAPPING)
    expect(row.discountTypeRaw).toBe('Mua 1 tặng 1')
    expect(row.discountType).toBeNull()
    expect(row.issues.discountType).toBe('unknown-discount-type')
  })

  it('reports a missing type as missing, not as unknown', () => {
    const row = normalizeRow('Key', rowWith({ 10: null }), MAPPING)
    expect(row.issues.discountTypeRaw).toBe('missing')
    expect(row.issues.discountType).toBeUndefined()
  })

  it('surfaces a formula error rather than reading it as an empty cell', () => {
    const row = normalizeRow('Key', rowWith({ 8: { error: '#DIV/0!' } }), MAPPING)
    expect(row.discountAmount).toBeNull()
    expect(row.issues.discountAmount).toBe('unparsable-number')
  })
})

describe('normalizeRow - unmapped columns', () => {
  it('reads unmapped fields as empty without throwing', () => {
    const mapping = mapColumns(['Mã hiệu', 'Kiểu ctkm', 'Tên ctkm'])
    const row = normalizeRow('Sheet2', { rowNumber: 4, cells: ['A1', 'Đồng giá', 'CT1'] }, mapping)
    expect(row.sku).toBe('A1')
    expect(row.discountType).toBe('same_price')
    expect(row.listPrice).toBeNull()
    expect(row.issues.startAt).toBe('missing')
  })

  it('survives a row shorter than the header', () => {
    const row = normalizeRow('Key', { rowNumber: 9, cells: ['KMAP1'] }, MAPPING)
    expect(row.productCode).toBe('KMAP1')
    expect(row.sku).toBeNull()
  })
})

describe('parseDiscountType', () => {
  it.each([
    ['Giảm giá theo số tiền', 'fixed_amount'],
    ['Giảm giá theo phần trăm', 'percentage'],
    ['Đồng giá', 'same_price'],
    ['GIẢM GIÁ THEO PHẦN TRĂM', 'percentage'],
  ])('reads %s as %s', (raw, expected) => {
    expect(parseDiscountType(raw)).toBe(expected)
  })

  it('prefers phần trăm when a row mentions both', () => {
    expect(parseDiscountType('giảm theo phần trăm, không theo số tiền')).toBe('percentage')
  })

  it('returns null for anything else, leaving it to rule C6', () => {
    expect(parseDiscountType('Mua 1 tặng 1')).toBeNull()
    expect(parseDiscountType(null)).toBeNull()
  })
})

describe('isEmptyRow', () => {
  it('spots a spacer row', () => {
    expect(isEmptyRow({ rowNumber: 5, cells: [null, '', '   ', null] })).toBe(true)
    expect(isEmptyRow({ rowNumber: 5, cells: [] })).toBe(true)
  })

  it('does not call a row with a zero in it empty', () => {
    expect(isEmptyRow({ rowNumber: 5, cells: [null, 0] })).toBe(false)
  })
})
