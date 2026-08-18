/**
 * Every implemented rule, in one list.
 *
 * `rule-catalog.ts` declares what should exist (and seeds `RuleConfig`); this
 * declares what actually runs. They are cross-checked by a test, and a mismatch
 * is deliberately a red test rather than a silent gap: a rule that is
 * catalogued, configurable and switched on, but never executed, would look like
 * a clean file to the user.
 *
 * Adding a rule means creating its file and adding it to its group's index -
 * nothing in the engine changes.
 */

import { GROUP_A_RULES } from './group-a-file-structure'
import { GROUP_B_RULES } from './group-b-catalog'
import { GROUP_C_RULES } from './group-c-arithmetic'
import { GROUP_D_RULES } from './group-d-program'
import { GROUP_E_RULES } from './group-e-overlap'
import type { Rule } from './types'

/** Groups A-E, i.e. everything that runs before import. Group F lands in phase 06. */
export const RULES: readonly Rule[] = [
  ...GROUP_A_RULES,
  ...GROUP_B_RULES,
  ...GROUP_C_RULES,
  ...GROUP_D_RULES,
  ...GROUP_E_RULES,
]

export const RULES_BY_CODE: ReadonlyMap<string, Rule> = new Map(
  RULES.map((rule) => [rule.code, rule]),
)

export function findRule(code: string): Rule | undefined {
  return RULES_BY_CODE.get(code)
}
