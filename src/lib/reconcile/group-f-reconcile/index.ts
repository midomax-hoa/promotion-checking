/**
 * The six reconciliation rules, in report order.
 *
 * Same arrangement as the checking groups: `rule-catalog.ts` declares what
 * should exist, this declares what runs, and a test cross-checks the two so a
 * catalogued-but-unimplemented rule fails the build instead of looking like a
 * clean reconciliation.
 */

import { f1ProgramNotFound } from './f1-program-not-found'
import { f2DiscountValueMismatch } from './f2-discount-value-mismatch'
import { f3DateMismatch } from './f3-date-mismatch'
import { f4PromotionDisabled } from './f4-promotion-disabled'
import { f5SkuCountMismatch } from './f5-sku-count-mismatch'
import { f6ExtraOnHaravan } from './f6-extra-on-haravan'
import type { ReconcileRule } from '../types'

export const GROUP_F_RULES: readonly ReconcileRule[] = [
  f1ProgramNotFound,
  f2DiscountValueMismatch,
  f3DateMismatch,
  f4PromotionDisabled,
  f5SkuCountMismatch,
  f6ExtraOnHaravan,
]

export const GROUP_F_RULES_BY_CODE: ReadonlyMap<string, ReconcileRule> = new Map(
  GROUP_F_RULES.map((rule) => [rule.code, rule]),
)
