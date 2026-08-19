import { describe, expect, it } from 'vitest'
import {
  RULE_CATALOG,
  RULE_CODES,
  SYSTEM_FINDING_TITLES,
  SYSTEM_RULE_CATALOG_EMPTY,
  SYSTEM_RECONCILE_AMBIGUOUS,
  SYSTEM_RECONCILE_DISAGREED,
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
      F2: { percentTolerance: 0.01 },
    })
  })

  it('keeps system finding codes out of the configurable catalog', () => {
    for (const code of [
      SYSTEM_RULE_CATALOG_EMPTY,
      SYSTEM_RECONCILE_AMBIGUOUS,
      SYSTEM_RECONCILE_DISAGREED,
    ]) {
      // These report missing or unusable input rather than a business rule, so
      // they must not be switchable off from the configuration screen.
      expect(RULE_CODES).not.toContain(code)
      expect(SYSTEM_FINDING_TITLES[code]).toBeTruthy()
    }
  })
})

describe('app settings catalog', () => {
  // 7 from phase 01, plus haravan.max_attempts, catalog.cursor_overlap_ms and
  // catalog.sync_shortfall_tolerance added with the catalog sync in phase 02,
  // plus shop.timezone_offset_minutes added with reconciliation in phase 06,
  // plus check.fetch_promotions, haravan.promotion_page_size and
  // haravan.promotion_max_pages added 2026-08-19 once the promotion endpoint
  // was measured against the real shop rather than a one-record dev store,
  // plus the four auth.* settings added 2026-08-19 with the login screen,
  // plus haravan.promotion_delay_ms and haravan.rate_limit_max_attempts added
  // 2026-08-19 after a full pull died on the endpoint's stricter throttle.
  it('declares 20 settings with unique keys', () => {
    expect(DEFAULT_APP_SETTINGS).toHaveLength(20)
    expect(new Set(DEFAULT_APP_SETTINGS.map((s) => s.key)).size).toBe(20)
  })

  it('ships the promotion fetch switched on', () => {
    // D8 and E3 are the only two rules that look outside the file, and the walk
    // costs about a minute at the shipped pacing - slow on purpose, and the
    // switch is the way out for whoever disagrees.
    const fetchPromotions = DEFAULT_APP_SETTINGS.find((s) => s.key === 'check.fetch_promotions')
    expect(fetchPromotions?.value).toBe('true')
  })

  it('ships the promotion page size at the measured server maximum', () => {
    // Measured 2026-08-19: the endpoint honours 250 and silently answers a
    // larger value with 50, so anything above 250 would quadruple the walk.
    const pageSize = DEFAULT_APP_SETTINGS.find((s) => s.key === 'haravan.promotion_page_size')
    expect(pageSize?.value).toBe('250')
  })

  it('never hard-codes the shop timezone - it is an editable setting', () => {
    const offset = DEFAULT_APP_SETTINGS.find((s) => s.key === 'shop.timezone_offset_minutes')
    expect(offset?.value).toBe('420')
  })
})
