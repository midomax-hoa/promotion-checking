/**
 * What the file says one program should look like on Haravan.
 *
 * Everything comes out in Haravan's unit, so no comparison downstream has to
 * remember that the file writes 0.5 where Haravan writes 50.
 *
 * A program whose rows disagree - two end dates, two discount amounts - has no
 * single expectation. That is reported by rule D3 before import and marked
 * `inconsistent` here, so group F stays silent about it instead of picking one
 * of the values and calling the other a difference.
 */

import type { DiscountType, PromotionProgram } from '@/lib/excel/types'
import type { ProgramExpectation } from './types'

/** Haravan stores a percentage as a whole number; the file stores a fraction. */
export const PERCENT_SCALE = 100

/**
 * `distinctDiscountTypes` is typed as plain strings, so it is narrowed here
 * rather than cast: an unrecognised kind must fall through to "not stated" and
 * silence the value comparison, not be trusted because it happened to be there.
 */
const DISCOUNT_TYPES: readonly string[] = ['fixed_amount', 'percentage', 'same_price']

function toDiscountType(raw: string | null): DiscountType | null {
  return raw != null && DISCOUNT_TYPES.includes(raw) ? (raw as DiscountType) : null
}

function single<T>(values: readonly T[]): { value: T | null; agreed: boolean } {
  const present = values.filter((value) => value != null)
  if (present.length === 0) return { value: null, agreed: true }
  if (present.length > 1) return { value: null, agreed: false }
  return { value: present[0], agreed: true }
}

export function readExpectation(program: PromotionProgram): ProgramExpectation {
  const discountType = single(program.distinctDiscountTypes)
  const start = single(program.distinctStarts)
  const end = single(program.distinctEnds)

  // Only the column that matches the declared kind is read. A percentage
  // program carrying a stray amount is C6's business, not this file's.
  const kind = toDiscountType(discountType.value)
  const amount = single(program.distinctAmounts)
  const percent = single(program.distinctPercents)

  let value: number | null = null
  let valueAgreed = true
  if (kind === 'fixed_amount') {
    value = amount.value
    valueAgreed = amount.agreed
  } else if (kind === 'percentage') {
    value = percent.value == null ? null : percent.value * PERCENT_SCALE
    valueAgreed = percent.agreed
  }
  // `same_price` names a final price rather than a reduction, so Haravan's
  // single `value` has nothing to be compared against. Left null on purpose.

  const distinctSkus = new Set<string>()
  for (const row of program.rows) {
    if (row.skuNormalized != null) distinctSkus.add(row.skuNormalized)
  }

  return {
    rowCount: program.rows.length,
    distinctSkuCount: distinctSkus.size,
    discountType: kind,
    value,
    startAt: start.value,
    endAt: end.value,
    inconsistent:
      !discountType.agreed || !valueAgreed || !start.agreed || !end.agreed,
  }
}
