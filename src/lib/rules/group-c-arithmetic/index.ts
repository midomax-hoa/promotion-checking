import type { Rule } from '../types'
import { c1PriceArithmetic } from './c1-price-arithmetic'
import { c2ZeroOrNegativeDiscount } from './c2-zero-or-negative-discount'
import { c3DiscountExceedsPrice } from './c3-discount-exceeds-price'
import { c4DiscountTooDeep } from './c4-discount-too-deep'
import { c5PercentWrittenAsWholeNumber } from './c5-percent-written-as-whole-number'
import { c6UnknownDiscountType } from './c6-unknown-discount-type'
import { c7PriceNotRounded } from './c7-price-not-rounded'

/** Group C - arithmetic inside a single row, no external data needed. */
export const GROUP_C_RULES: readonly Rule[] = [
  c1PriceArithmetic,
  c2ZeroOrNegativeDiscount,
  c3DiscountExceedsPrice,
  c4DiscountTooDeep,
  c5PercentWrittenAsWholeNumber,
  c6UnknownDiscountType,
  c7PriceNotRounded,
]
