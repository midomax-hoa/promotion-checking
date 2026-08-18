import { describe, expect, it } from 'vitest'
import { RULE_CATALOG } from '@/lib/rules/rule-catalog'
import { RULES, RULES_BY_CODE, findRule } from '@/lib/rules/registry'
import { mergeRuleConfigs } from '@/lib/rules/rule-config-store'

/**
 * The catalog is what the seed writes into `RuleConfig` and what the settings
 * screen lists. A code that is catalogued but not implemented would appear
 * switched on and simply never run, so the mismatch has to fail loudly here.
 */
const CHECK_CODES = RULE_CATALOG.filter((rule) => rule.groupCode !== 'F').map((rule) => rule.code)

describe('registry', () => {
  it('implements every catalogued rule in groups A-E', () => {
    const missing = CHECK_CODES.filter((code) => !RULES_BY_CODE.has(code))
    expect(missing).toEqual([])
  })

  it('implements nothing that is not catalogued', () => {
    const catalogued = new Set(RULE_CATALOG.map((rule) => rule.code))
    expect(RULES.map((rule) => rule.code).filter((code) => !catalogued.has(code))).toEqual([])
  })

  it('does not implement group F yet - that is phase 06', () => {
    expect(RULES.some((rule) => rule.code.startsWith('F'))).toBe(false)
  })

  it('carries 31 rules with unique codes', () => {
    expect(RULES).toHaveLength(31)
    expect(RULES_BY_CODE.size).toBe(RULES.length)
  })

  it('declares the same group as the catalog', () => {
    for (const rule of RULES) {
      expect(rule.groupCode).toBe(RULE_CATALOG.find((entry) => entry.code === rule.code)?.groupCode)
    }
  })

  it('marks exactly the rules that read external data', () => {
    const requiring = (requirement: string) =>
      RULES.filter((rule) => rule.requires?.includes(requirement as never)).map((r) => r.code)

    expect(requiring('catalog')).toEqual(['B1', 'B2', 'B3', 'B5', 'B6'])
    expect(requiring('haravan-promotions')).toEqual(['D8', 'E3'])
  })

  it('finds a rule by code', () => {
    expect(findRule('B1')?.groupCode).toBe('B')
    expect(findRule('Z9')).toBeUndefined()
  })
})

describe('rule config merge', () => {
  it('falls back to the catalog default for a rule with no stored row', () => {
    const configs = mergeRuleConfigs([])
    const c4 = configs.find((config) => config.code === 'C4')

    expect(c4).toEqual({
      code: 'C4',
      enabled: true,
      severity: 'warn',
      params: { maxDiscountPercent: 70 },
    })
  })

  it('lets a stored row override enabled, severity and params', () => {
    const configs = mergeRuleConfigs([
      { code: 'C4', enabled: false, severity: 'critical', params: { maxDiscountPercent: 50 } },
    ])
    expect(configs.find((config) => config.code === 'C4')).toEqual({
      code: 'C4',
      enabled: false,
      severity: 'critical',
      params: { maxDiscountPercent: 50 },
    })
  })

  it('keeps untouched defaults when the stored params are partial', () => {
    const configs = mergeRuleConfigs([
      { code: 'D7', enabled: true, severity: 'warn', params: { maxDurationDays: 30 } },
    ])
    expect(configs.find((config) => config.code === 'D7')?.params).toEqual({
      maxDurationDays: 30,
      minDurationDays: 1,
    })
  })

  it('ignores a nonsense severity rather than crashing the run', () => {
    const configs = mergeRuleConfigs([
      { code: 'C2', enabled: true, severity: 'catastrophic', params: null },
    ])
    expect(configs.find((config) => config.code === 'C2')?.severity).toBe('critical')
  })

  it('drops non-scalar params and rows for unknown codes', () => {
    const configs = mergeRuleConfigs([
      { code: 'C4', enabled: true, severity: 'warn', params: { maxDiscountPercent: { deep: 1 } } },
      { code: 'ZZ9', enabled: true, severity: 'warn', params: null },
    ])
    expect(configs.find((config) => config.code === 'C4')?.params).toEqual({ maxDiscountPercent: 70 })
    expect(configs.some((config) => config.code === 'ZZ9')).toBe(false)
  })

  it('covers every catalogued rule, group F included', () => {
    expect(mergeRuleConfigs([])).toHaveLength(RULE_CATALOG.length)
  })
})
