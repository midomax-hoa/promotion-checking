import { describe, expect, it } from 'vitest'
import { shouldFetchPromotions } from '@/lib/rules/run-check'
import type { RuleConfigInput } from '@/lib/rules/rule-config-store'

/**
 * The promotion walk is the only network call a check run makes, and on a shop
 * holding more promotions than the fetcher can page through it costs about a
 * minute and then fails. These tests pin the two gates that keep it out of the
 * request path.
 */

const config = (code: string, enabled: boolean): RuleConfigInput => ({
  code,
  enabled,
  severity: 'danger',
  params: {},
})

/** D8 and E3 are the rules declaring `requires: ['haravan-promotions']`. */
const ALL_ON: RuleConfigInput[] = [
  config('A1', true),
  config('D8', true),
  config('E3', true),
]

describe('shouldFetchPromotions', () => {
  it('does not fetch while the setting is off, however the rules are configured', () => {
    expect(shouldFetchPromotions(ALL_ON, false)).toBe(false)
  })

  it('fetches when the setting is on and a rule wants the list', () => {
    expect(shouldFetchPromotions(ALL_ON, true)).toBe(true)
  })

  it('does not fetch when every rule needing the list is switched off', () => {
    // The bug this closes: the list was fetched, walked and thrown away for
    // rules the operator had already turned off on the configuration screen.
    const configs = [config('A1', true), config('D8', false), config('E3', false)]
    expect(shouldFetchPromotions(configs, true)).toBe(false)
  })

  it('still fetches when only one of the two rules is on', () => {
    expect(shouldFetchPromotions([config('D8', false), config('E3', true)], true)).toBe(true)
    expect(shouldFetchPromotions([config('D8', true), config('E3', false)], true)).toBe(true)
  })

  it('does not fetch for rules that never needed the list', () => {
    // A1 and C1 read nothing but the workbook; enabling them must not trigger
    // a network call.
    expect(shouldFetchPromotions([config('A1', true), config('C1', true)], true)).toBe(false)
  })

  it('does not fetch when no rule is configured at all', () => {
    expect(shouldFetchPromotions([], true)).toBe(false)
  })
})
