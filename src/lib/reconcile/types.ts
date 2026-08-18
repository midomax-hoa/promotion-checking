/**
 * Contracts for reconciliation - what the file said against what Haravan holds.
 *
 * Same discipline as the checking rules: a group F rule is a pure function over
 * an already-built match list. Fetching, waiting between passes and writing to
 * the database all happen outside, so every rule stays testable with a literal.
 *
 * Unit convention, stated once because the two sides disagree: inside a
 * `PromotionRow` a percentage is a decimal fraction (0.5), while Haravan stores
 * a whole number (50). Everything in this folder works in **Haravan's unit**,
 * so a comparison never has to remember which side it is looking at.
 */

import type { CatalogIndex } from '@/lib/catalog/catalog-index'
import type { DiscountType, PromotionProgram } from '@/lib/excel/types'
import type { HaravanTakeType } from '@/lib/haravan/promotion-types'
import type { HaravanPromotion, RuleFinding, RuleParams } from '@/lib/rules/types'

/**
 * A Haravan promotion with everything reconciliation needs, on top of the
 * narrower shape the checking rules D8 and E3 already consume.
 */
export type ReconcilePromotion = HaravanPromotion & {
  takeType: HaravanTakeType | null
  /** Dong for `fixed_amount`, whole percent for `percentage`. */
  value: number | null
  usageLimit: number | null
  /** Verbatim `status`, so the screen can show what Haravan actually said. */
  status: string | null
  /**
   * Variants covered, resolved from `entitled_variant_ids` plus every variant of
   * `entitled_product_ids`. **null means it could not be resolved** - an empty
   * attachment, or a catalog cache that does not hold the products - and rule F5
   * skips rather than reporting a difference it cannot stand behind.
   */
  attachedVariantCount: number | null
  /** True when the promotion attaches whole products instead of single variants. */
  attachedByProduct: boolean
}

export type MatchStatus = 'matched' | 'not-found' | 'ambiguous' | 'extra-on-haravan'

/**
 * One program's worth of expectation, read off the file.
 *
 * `inconsistent` is what stops reconciliation from inventing an answer: a
 * program whose rows carry two different end dates has no single expected end
 * date, and rule D3 has already reported it. Group F says nothing about it
 * rather than picking one of the two and calling the other a mismatch.
 */
export type ProgramExpectation = {
  rowCount: number
  /**
   * Distinct usable SKUs, which is what Haravan actually receives - a program
   * listing one SKU twice sends one variant, not two. Rule F5 compares this
   * rather than `rowCount`, so a duplicate row does not read as a shortfall.
   */
  distinctSkuCount: number
  discountType: DiscountType | null
  /** In Haravan's unit: dong, or whole percent. null = not stated, or not agreed. */
  value: number | null
  startAt: Date | null
  endAt: Date | null
  inconsistent: boolean
}

export type MatchResult = {
  programName: string
  /** null only for `extra-on-haravan`, where there is no Excel side at all. */
  expectation: ProgramExpectation | null
  /** null only for `extra-on-haravan`; kept so a finding can point at real rows. */
  excelProgram: PromotionProgram | null
  /** More than one entry means Haravan holds duplicate names - status `ambiguous`. */
  haravanMatches: ReconcilePromotion[]
  status: MatchStatus
}

export type ReconcileContext = {
  matches: readonly MatchResult[]
  catalog: CatalogIndex
  /** From AppSetting `check.money_tolerance_vnd`. */
  moneyToleranceVnd: number
  /** From AppSetting `shop.timezone_offset_minutes`. */
  shopTimezoneOffsetMinutes: number
  /** Params of the rule currently running, merged with its catalog defaults. */
  params: RuleParams
}

export type ReconcileRule = {
  code: string
  run(ctx: ReconcileContext): RuleFinding[]
}
