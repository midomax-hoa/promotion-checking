import { describe, expect, it } from 'vitest'
import { cellText, isBlankCell, normalizeHeader, unwrapCell } from '@/lib/excel/cell-value'

/** Copied verbatim from `promotion.t8.xlsx`, header row, column G. */
const SO_DU_HEADER = {
  richText: [
    { font: null, text: 'Số dư\n' },
    { font: { bold: true, size: 8 }, text: '(Để trống nếu không giới hạn)' },
  ],
}

describe('unwrapCell', () => {
  it('passes primitives and Dates straight through', () => {
    const date = new Date('2026-08-01T00:00:00.000Z')
    expect(unwrapCell('abc')).toBe('abc')
    expect(unwrapCell(130000)).toBe(130000)
    expect(unwrapCell(unwrapCell(date))).toBe(date)
    expect(unwrapCell(null)).toBeNull()
    expect(unwrapCell(undefined)).toBeNull()
  })

  it('reads a formula cell as its cached result - every Tên ctkm in the real file is one', () => {
    expect(unwrapCell({ formula: 'F2-H2', result: 130000 })).toBe(130000)
    expect(unwrapCell({ sharedFormula: 'I2', result: 130000 })).toBe(130000)
    // What the streaming reader emits for shared-formula followers.
    expect(unwrapCell({ formula: '', result: '2608GST130K' })).toBe('2608GST130K')
  })

  it('returns null for a formula that has never been calculated', () => {
    expect(unwrapCell({ formula: 'F2-H2' })).toBeNull()
  })

  it('joins rich text, which is how the Số dư header is stored', () => {
    expect(unwrapCell(SO_DU_HEADER)).toBe('Số dư\n(Để trống nếu không giới hạn)')
  })

  it('surfaces a formula error as its text so it cannot be mistaken for an empty cell', () => {
    expect(unwrapCell({ error: '#DIV/0!' })).toBe('#DIV/0!')
    expect(unwrapCell({ formula: 'F2/0', result: { error: '#DIV/0!' } })).toBe('#DIV/0!')
  })

  it('takes the label from a hyperlink cell', () => {
    expect(unwrapCell({ text: 'KMAP231728F', hyperlink: 'https://example.com' })).toBe(
      'KMAP231728F',
    )
  })
})

describe('cellText', () => {
  it('trims and turns nothing-left into null', () => {
    expect(cellText('  KMAP231728F.L ')).toBe('KMAP231728F.L')
    expect(cellText('   ')).toBeNull()
    expect(cellText(null)).toBeNull()
  })

  it('stringifies numbers so a numeric SKU survives', () => {
    expect(cellText(12345)).toBe('12345')
    expect(cellText(0)).toBe('0')
  })
})

describe('isBlankCell', () => {
  it('treats empty, whitespace and uncalculated formulas as blank', () => {
    expect(isBlankCell(null)).toBe(true)
    expect(isBlankCell('')).toBe(true)
    expect(isBlankCell('  \n ')).toBe(true)
    expect(isBlankCell({ formula: 'F2-H2' })).toBe(true)
  })

  it('does not treat zero or a formula error as blank', () => {
    // The 279 rows discounting 0đ must be seen as "zero", not "empty".
    expect(isBlankCell(0)).toBe(false)
    expect(isBlankCell({ formula: 'F2-H2', result: 0 })).toBe(false)
    expect(isBlankCell({ error: '#N/A' })).toBe(false)
  })
})

describe('normalizeHeader', () => {
  it('collapses the newline inside the Số dư header so it can be matched', () => {
    expect(normalizeHeader(SO_DU_HEADER)).toBe('số dư (để trống nếu không giới hạn)')
  })

  it('collapses \\r\\n, tabs and repeated spaces alike', () => {
    expect(normalizeHeader('Số dư\r\n(Để trống)')).toBe('số dư (để trống)')
    expect(normalizeHeader('  Mã \t hiệu  ')).toBe('mã hiệu')
  })

  it('returns null for an unnamed column', () => {
    expect(normalizeHeader(null)).toBeNull()
    expect(normalizeHeader('   ')).toBeNull()
  })
})
