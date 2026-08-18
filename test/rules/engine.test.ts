import { describe, expect, it } from 'vitest'
import { runRules } from '@/lib/rules/engine'
import { RULES } from '@/lib/rules/registry'
import { mergeRuleConfigs, type RuleConfigInput } from '@/lib/rules/rule-config-store'
import { SYSTEM_RULE_CATALOG_EMPTY } from '@/lib/rules/rule-catalog'
import type { Rule } from '@/lib/rules/types'
import { EMPTY_CATALOG, makeCatalog, makePromotion, makeRow, makeWorkbook } from './fixtures'

const NOW = new Date(2026, 7, 18)

function run(options: {
  configs?: RuleConfigInput[]
  rules?: readonly Rule[]
  catalog?: ReturnType<typeof makeCatalog>
  haravanPromotions?: ReturnType<typeof makePromotion>[] | null
  rows?: ReturnType<typeof makeRow>[]
}) {
  return runRules({
    workbook: makeWorkbook(options.rows ?? [makeRow({ rowNumber: 2, sku: 'A1' })]),
    catalog: options.catalog ?? makeCatalog([{ sku: 'A1' }]),
    haravanPromotions: options.haravanPromotions ?? null,
    now: NOW,
    moneyToleranceVnd: 0.5,
    configs: options.configs ?? mergeRuleConfigs([]),
    rules: options.rules,
  })
}

/** Two throwaway rules, so engine behaviour is tested without any real rule's logic. */
const alwaysWarns: Rule = {
  code: 'C7',
  groupCode: 'C',
  run: () => [{ message: 'luôn báo' }],
}
const needsCatalog: Rule = {
  code: 'B1',
  groupCode: 'B',
  requires: ['catalog'],
  run: () => [{ message: 'cần danh mục' }],
}

describe('rule selection', () => {
  it('skips a rule that is switched off, and lists it', () => {
    const configs = mergeRuleConfigs([]).map((config) =>
      config.code === 'C7' ? { ...config, enabled: false } : config,
    )
    const result = run({ configs, rules: [alwaysWarns] })

    expect(result.findings).toHaveLength(0)
    expect(result.skippedRules).toContain('C7')
  })

  it('runs a rule that is switched on', () => {
    const result = run({ rules: [alwaysWarns] })
    expect(result.findings.map((f) => f.ruleCode)).toEqual(['C7'])
    expect(result.skippedRules).not.toContain('C7')
  })

  it('treats a rule with no configuration row as off', () => {
    const result = run({ configs: [], rules: [alwaysWarns] })
    expect(result.findings).toHaveLength(0)
    expect(result.skippedRules).toEqual(['C7'])
  })

  it('stamps each finding with the configured severity', () => {
    const configs = mergeRuleConfigs([]).map((config) =>
      config.code === 'C7' ? { ...config, severity: 'critical' as const } : config,
    )
    expect(run({ configs, rules: [alwaysWarns] }).findings[0].severity).toBe('critical')
  })

  it('hands each rule its own params', () => {
    const seen: unknown[] = []
    const spy: Rule = { code: 'C4', groupCode: 'C', run: (ctx) => (seen.push(ctx.params), []) }
    run({ rules: [spy] })
    expect(seen).toEqual([{ maxDiscountPercent: 70 }])
  })
})

describe('empty catalog guard', () => {
  it('skips the catalog rules and says why, instead of reporting every SKU as missing', () => {
    const result = run({ catalog: EMPTY_CATALOG, rules: [needsCatalog, alwaysWarns] })

    expect(result.skippedRules).toContain('B1')
    expect(result.findings.map((f) => f.ruleCode)).toContain(SYSTEM_RULE_CATALOG_EMPTY)
    expect(result.findings.some((f) => f.ruleCode === 'B1')).toBe(false)
    // Rules that need nothing external keep working.
    expect(result.findings.some((f) => f.ruleCode === 'C7')).toBe(true)
  })

  it('treats a synced but empty cache as unusable too', () => {
    const result = run({ catalog: makeCatalog([], new Date(2026, 7, 18)), rules: [needsCatalog] })
    expect(result.skippedRules).toContain('B1')
  })

  it('stays quiet when no rule in the run wanted the catalog', () => {
    const result = run({ catalog: EMPTY_CATALOG, rules: [alwaysWarns] })
    expect(result.findings.map((f) => f.ruleCode)).toEqual(['C7'])
  })

  it('runs the catalog rules once the cache is there', () => {
    const result = run({ rules: [needsCatalog] })
    expect(result.findings.map((f) => f.ruleCode)).toEqual(['B1'])
    expect(result.skippedRules).not.toContain('B1')
  })
})

describe('missing Haravan promotions', () => {
  it('skips D8 and E3 and records them rather than passing them', () => {
    const result = run({ haravanPromotions: null })
    expect(result.skippedRules).toEqual(expect.arrayContaining(['D8', 'E3']))
  })

  it('runs them once the list is supplied', () => {
    const result = run({ haravanPromotions: [] })
    expect(result.skippedRules).not.toContain('D8')
    expect(result.skippedRules).not.toContain('E3')
  })
})

describe('result shape', () => {
  it('counts findings per severity', () => {
    const result = run({ rules: RULES })
    const sum = result.counts.critical + result.counts.danger + result.counts.warn
    expect(sum).toBe(result.findings.length)
  })

  it('orders equally severe findings by catalog position, not alphabetically', () => {
    // Both danger, so only the rule order decides - and "D10" sorts before "D3"
    // as a string, which is exactly the trap.
    const d3: Rule = { code: 'D3', groupCode: 'D', run: () => [{ message: 'd3' }] }
    const d10: Rule = { code: 'D10', groupCode: 'D', run: () => [{ message: 'd10' }] }

    const result = run({ rules: [d10, d3] })
    expect(result.findings.map((f) => f.ruleCode)).toEqual(['D3', 'D10'])
  })

  it('puts the worst severity first', () => {
    const warn: Rule = { code: 'D4', groupCode: 'D', run: () => [{ message: 'warn' }] }
    const critical: Rule = { code: 'D6', groupCode: 'D', run: () => [{ message: 'critical' }] }

    const result = run({ rules: [warn, critical] })
    expect(result.findings.map((f) => f.severity)).toEqual(['critical', 'warn'])
  })

  it('lists D1 and D2 as skipped by default', () => {
    const result = run({ rules: RULES })
    expect(result.skippedRules).toEqual(expect.arrayContaining(['D1', 'D2']))
  })
})
