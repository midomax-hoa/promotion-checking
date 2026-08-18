import { describe, expect, it } from 'vitest'
import { readExpectation } from '@/lib/reconcile/program-expectation'
import { groupPrograms } from '@/lib/excel/program-grouper'
import { makeRow } from '../rules/fixtures'
import { makeRawPromotion, makeReconcilePromotion } from './fixtures'

/**
 * Reading one program's expectation out of the file. Separate from the rule
 * tests because it is a separate question: those ask what gets reported, this
 * asks what the file was understood to say in the first place.
 */

describe('readExpectation', () => {
  it('scales a percentage into Haravan units and counts distinct SKUs', () => {
    const programs = groupPrograms([
      makeRow({ programName: 'X', sku: 'A', discountType: 'percentage', discountPercent: 0.5 }),
      makeRow({ programName: 'X', sku: 'A', discountType: 'percentage', discountPercent: 0.5 }),
      makeRow({ programName: 'X', sku: 'B', discountType: 'percentage', discountPercent: 0.5 }),
    ])
    const expectation = readExpectation(programs[0])

    expect(expectation.value).toBe(50)
    expect(expectation.rowCount).toBe(3)
    expect(expectation.distinctSkuCount).toBe(2)
    expect(expectation.inconsistent).toBe(false)
  })

  it('marks a program whose rows disagree', () => {
    const programs = groupPrograms([
      makeRow({ programName: 'X', endAt: new Date(2026, 7, 31) }),
      makeRow({ programName: 'X', endAt: new Date(2026, 8, 30) }),
    ])
    expect(readExpectation(programs[0]).inconsistent).toBe(true)
  })

  it('states no value for a same-price program', () => {
    const programs = groupPrograms([
      makeRow({ programName: 'X', discountType: 'same_price', discountAmount: null }),
    ])
    expect(readExpectation(programs[0]).value).toBeNull()
  })
})

describe('raw promotion shape', () => {
  it('ignores discount_type, which always says product_amount', () => {
    const promotion = makeReconcilePromotion(makeRawPromotion({ take_type: 'percentage' }))
    expect(promotion.takeType).toBe('percentage')
  })
})
