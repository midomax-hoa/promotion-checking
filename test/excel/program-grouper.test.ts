import { describe, expect, it } from 'vitest'
import { groupPrograms, programKey } from '@/lib/excel/program-grouper'
import { UNNAMED_PROGRAM, type PromotionRow } from '@/lib/excel/types'

let nextRow = 2

function row(overrides: Partial<PromotionRow> = {}): PromotionRow {
  nextRow += 1
  return {
    sheetName: 'Key',
    rowNumber: nextRow,
    productCode: 'KMAP1',
    sku: 'KMAP1.L',
    skuNormalized: 'kmap1.l',
    productName: null,
    variantName: null,
    unit: null,
    listPrice: 289000,
    usageLimit: null,
    priceAfter: 159000,
    discountAmount: 130000,
    discountPercent: null,
    discountTypeRaw: 'Giảm giá theo số tiền',
    discountType: 'fixed_amount',
    startAt: new Date(2026, 7, 1),
    endAt: new Date(2026, 7, 31),
    programName: '2608GST130K',
    issues: {},
    ...overrides,
  }
}

describe('groupPrograms', () => {
  it('collects rows sharing a name into one program', () => {
    const programs = groupPrograms([row(), row(), row({ programName: '2608GST0K' })])
    expect(programs.map((program) => [program.name, program.rows.length])).toEqual([
      ['2608GST130K', 2],
      ['2608GST0K', 1],
    ])
  })

  it('keeps the order the programs first appear in the file', () => {
    const programs = groupPrograms([
      row({ programName: 'B' }),
      row({ programName: 'A' }),
      row({ programName: 'B' }),
    ])
    expect(programs.map((program) => program.name)).toEqual(['B', 'A'])
  })

  it('ignores surrounding whitespace when matching names', () => {
    const programs = groupPrograms([row({ programName: ' 2608GST130K ' }), row()])
    expect(programs).toHaveLength(1)
    expect(programs[0].name).toBe('2608GST130K')
  })

  it('groups across sheets and records every sheet involved', () => {
    const programs = groupPrograms([row(), row({ sheetName: 'Giảm phần trăm' })])
    expect(programs[0].sheetNames).toEqual(['Key', 'Giảm phần trăm'])
  })
})

describe('groupPrograms - conflicts Haravan cannot express', () => {
  it('reports one value when the program is consistent', () => {
    const programs = groupPrograms([row(), row(), row()])
    expect(programs[0].distinctAmounts).toEqual([130000])
    expect(programs[0].distinctStarts).toHaveLength(1)
    expect(programs[0].distinctEnds).toHaveLength(1)
    expect(programs[0].distinctDiscountTypes).toEqual(['fixed_amount'])
    expect(programs[0].distinctUsageLimits).toEqual([null])
  })

  it('exposes two amounts when the rows disagree', () => {
    const programs = groupPrograms([row(), row({ discountAmount: 999000 })])
    expect(programs[0].distinctAmounts).toEqual([130000, 999000])
  })

  it('compares dates by value, not by object identity', () => {
    const programs = groupPrograms([
      row({ endAt: new Date(2026, 7, 31) }),
      row({ endAt: new Date(2026, 7, 31) }),
    ])
    expect(programs[0].distinctEnds).toHaveLength(1)
  })

  it('exposes two end dates when one row differs by a day', () => {
    const programs = groupPrograms([row(), row({ endAt: new Date(2026, 7, 30) })])
    expect(programs[0].distinctEnds).toHaveLength(2)
  })

  it('counts a missing date as its own distinct value', () => {
    const programs = groupPrograms([row(), row({ startAt: null })])
    expect(programs[0].distinctStarts).toHaveLength(2)
    expect(programs[0].distinctStarts).toContain(null)
  })

  it('exposes a mix of discount types', () => {
    const programs = groupPrograms([
      row(),
      row({ discountType: 'percentage', discountPercent: 0.5 }),
    ])
    expect(programs[0].distinctDiscountTypes).toEqual(['fixed_amount', 'percentage'])
    expect(programs[0].distinctPercents).toEqual([null, 0.5])
  })

  it('leaves unknown types out - rule C6 already reports them per row', () => {
    const programs = groupPrograms([row(), row({ discountType: null })])
    expect(programs[0].distinctDiscountTypes).toEqual(['fixed_amount'])
  })
})

describe('programKey', () => {
  it.each([null, '', '   '])('buckets a blank name (%s) rather than dropping the row', (name) => {
    expect(programKey(row({ programName: name }))).toBe(UNNAMED_PROGRAM)
  })

  it('keeps unnamed rows visible in the grouping', () => {
    const programs = groupPrograms([row({ programName: null }), row()])
    expect(programs.map((program) => program.name)).toEqual([UNNAMED_PROGRAM, '2608GST130K'])
  })
})

describe('groupPrograms - empty input', () => {
  it('returns nothing rather than throwing', () => {
    expect(groupPrograms([])).toEqual([])
  })
})
