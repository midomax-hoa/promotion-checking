import { describe, expect, it } from 'vitest'
import { c1PriceArithmetic } from '@/lib/rules/group-c-arithmetic/c1-price-arithmetic'
import { c2ZeroOrNegativeDiscount } from '@/lib/rules/group-c-arithmetic/c2-zero-or-negative-discount'
import { c3DiscountExceedsPrice } from '@/lib/rules/group-c-arithmetic/c3-discount-exceeds-price'
import { c4DiscountTooDeep } from '@/lib/rules/group-c-arithmetic/c4-discount-too-deep'
import { c5PercentWrittenAsWholeNumber } from '@/lib/rules/group-c-arithmetic/c5-percent-written-as-whole-number'
import { c6UnknownDiscountType } from '@/lib/rules/group-c-arithmetic/c6-unknown-discount-type'
import { c7PriceNotRounded } from '@/lib/rules/group-c-arithmetic/c7-price-not-rounded'
import { makeRow, runRule } from './fixtures'

describe('C1 - price arithmetic', () => {
  it('reports the gap in đồng', () => {
    const rows = [makeRow({ listPrice: 289_000, discountAmount: 130_000, priceAfter: 160_000 })]
    const findings = runRule(c1PriceArithmetic, { rows })

    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('lệch 1.000đ')
  })

  it('accepts a floating point tail within tolerance', () => {
    const rows = [makeRow({ listPrice: 289_000.0000001, discountAmount: 130_000, priceAfter: 159_000 })]
    expect(runRule(c1PriceArithmetic, { rows })).toHaveLength(0)
  })

  it('leaves incomplete rows to the rules that own them', () => {
    const rows = [makeRow({ discountAmount: null })]
    expect(runRule(c1PriceArithmetic, { rows })).toHaveLength(0)
  })
})

describe('C2 - zero or negative discount', () => {
  it('reports a zero discount and says Haravan will refuse the program', () => {
    const rows = [makeRow({ discountAmount: 0, priceAfter: 100_000 })]
    const findings = runRule(c2ZeroOrNegativeDiscount, { rows })

    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('số tiền giảm 0đ')
    expect(findings[0].message).toContain('422')
  })

  it('reports a negative discount', () => {
    const rows = [makeRow({ discountAmount: -5000 })]
    expect(runRule(c2ZeroOrNegativeDiscount, { rows })[0].message).toContain('-5.000đ')
  })

  it('reports a blank amount on a fixed-amount row', () => {
    const rows = [makeRow({ discountAmount: null, priceAfter: 100_000 })]
    expect(runRule(c2ZeroOrNegativeDiscount, { rows })[0].message).toContain('để trống')
  })

  it('leaves a percentage row with a blank amount alone', () => {
    const rows = [
      makeRow({ discountType: 'percentage', discountTypeRaw: 'Giảm giá theo phần trăm', discountAmount: null, discountPercent: 0.5 }),
    ]
    expect(runRule(c2ZeroOrNegativeDiscount, { rows })).toHaveLength(0)
  })
})

describe('C3 - discount at or above the list price', () => {
  it('says what the customer would pay', () => {
    const rows = [makeRow({ listPrice: 100_000, discountAmount: 120_000, priceAfter: -20_000 })]
    expect(runRule(c3DiscountExceedsPrice, { rows })[0].message).toContain('mua với giá 0đ')
  })

  it('leaves zero discounts to C2', () => {
    const rows = [makeRow({ listPrice: 0, discountAmount: 0 })]
    expect(runRule(c3DiscountExceedsPrice, { rows })).toHaveLength(0)
  })
})

describe('C4 - discount too deep', () => {
  const deepRow = makeRow({ listPrice: 100_000, discountAmount: 80_000, priceAfter: 20_000 })

  it('stays quiet below the configured ceiling', () => {
    expect(runRule(c4DiscountTooDeep, { rows: [deepRow], params: { maxDiscountPercent: 90 } })).toHaveLength(0)
  })

  it('fires once the ceiling drops below the actual discount', () => {
    const findings = runRule(c4DiscountTooDeep, { rows: [deepRow], params: { maxDiscountPercent: 70 } })
    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('80%')
    expect(findings[0].message).toContain('vượt ngưỡng 70%')
  })

  it('reads the depth straight from a percentage row', () => {
    const rows = [makeRow({ discountPercent: 0.85, discountAmount: null, discountType: 'percentage' })]
    expect(runRule(c4DiscountTooDeep, { rows })[0].message).toContain('giảm 85%')
  })
})

describe('C5 - percentage written as a whole number', () => {
  it('spells out the value that was meant', () => {
    const rows = [makeRow({ discountPercent: 50 })]
    const findings = runRule(c5PercentWrittenAsWholeNumber, { rows })

    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('phải viết là 0.5')
  })

  it('accepts a decimal fraction', () => {
    expect(runRule(c5PercentWrittenAsWholeNumber, { rows: [makeRow({ discountPercent: 0.5 })] })).toHaveLength(0)
  })
})

describe('C6 - unknown or mismatched discount type', () => {
  it('reports a blank type', () => {
    const rows = [makeRow({ discountTypeRaw: null, discountType: null })]
    expect(runRule(c6UnknownDiscountType, { rows })[0].message).toContain('để trống')
  })

  it('quotes an unrecognised type back', () => {
    const rows = [makeRow({ discountTypeRaw: 'Mua 1 tặng 1', discountType: null })]
    expect(runRule(c6UnknownDiscountType, { rows })[0].message).toContain('"Mua 1 tặng 1"')
  })

  it('catches a value sitting in the column the declared type does not read', () => {
    const rows = [makeRow({ discountAmount: null, discountPercent: 0.5 })]
    const findings = runRule(c6UnknownDiscountType, { rows })
    expect(findings[0].message).toContain('"Số tiền giảm" để trống')
    expect(findings[0].message).toContain('nằm ở cột "Phần trăm giảm"')
  })

  it('accepts a well formed row', () => {
    expect(runRule(c6UnknownDiscountType)).toHaveLength(0)
  })
})

describe('C7 - price not rounded', () => {
  it('suggests both neighbours', () => {
    const rows = [makeRow({ priceAfter: 158_700 })]
    const findings = runRule(c7PriceNotRounded, { rows })

    expect(findings).toHaveLength(1)
    expect(findings[0].suggestion).toContain('158.000đ')
    expect(findings[0].suggestion).toContain('159.000đ')
  })

  it('honours a different rounding unit', () => {
    expect(runRule(c7PriceNotRounded, { rows: [makeRow({ priceAfter: 158_700 })], params: { roundingUnit: 100 } })).toHaveLength(0)
  })

  it('treats a rounding unit of zero as disabled', () => {
    expect(runRule(c7PriceNotRounded, { rows: [makeRow({ priceAfter: 158_700 })], params: { roundingUnit: 0 } })).toHaveLength(0)
  })
})
