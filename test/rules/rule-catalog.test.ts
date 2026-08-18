import { describe, expect, it } from 'vitest'
import {
  RULE_CATALOG,
  RULE_CODES,
  SYSTEM_FINDING_TITLES,
  SYSTEM_RULE_CATALOG_EMPTY,
} from '@/lib/rules/rule-catalog'
import { DEFAULT_APP_SETTINGS } from '@/lib/config/app-settings-catalog'

describe('rule catalog', () => {
  it('declares exactly 37 rules', () => {
    expect(RULE_CATALOG).toHaveLength(37)
  })

  it('has no duplicate rule code', () => {
    expect(new Set(RULE_CODES).size).toBe(RULE_CODES.length)
  })

  it('has the expected number of rules per group', () => {
    const perGroup = RULE_CATALOG.reduce<Record<string, number>>((acc, rule) => {
      acc[rule.groupCode] = (acc[rule.groupCode] ?? 0) + 1
      return acc
    }, {})
    expect(perGroup).toEqual({ A: 5, B: 6, C: 7, D: 10, E: 3, F: 6 })
  })

  it('ships D1 and D2 disabled by default', () => {
    const disabled = RULE_CATALOG.filter((r) => !r.defaultEnabled).map((r) => r.code)
    expect(disabled).toEqual(['D1', 'D2'])
  })

  it('carries the documented default thresholds', () => {
    const params = Object.fromEntries(
      RULE_CATALOG.filter((r) => r.defaultParams).map((r) => [r.code, r.defaultParams]),
    )
    expect(params).toEqual({
      B1: { suggestMaxDistance: 2, suggestMaxComparisons: 2_000_000 },
      C4: { maxDiscountPercent: 70 },
      C5: { maxPercentValue: 1 },
      C7: { roundingUnit: 1000 },
      D7: { maxDurationDays: 90, minDurationDays: 1 },
    })
  })

  it('keeps system finding codes out of the configurable catalog', () => {
    expect(RULE_CODES).not.toContain(SYSTEM_RULE_CATALOG_EMPTY)
    expect(SYSTEM_FINDING_TITLES[SYSTEM_RULE_CATALOG_EMPTY]).toBeTruthy()
  })
})

describe('app settings catalog', () => {
  // 7 from phase 01, plus haravan.max_attempts, catalog.cursor_overlap_ms and
  // catalog.sync_shortfall_tolerance added with the catalog sync in phase 02.
  it('declares 10 settings with unique keys', () => {
    expect(DEFAULT_APP_SETTINGS).toHaveLength(10)
    expect(new Set(DEFAULT_APP_SETTINGS.map((s) => s.key)).size).toBe(10)
  })
})
