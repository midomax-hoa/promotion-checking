/**
 * The acceptance test for phase 04: the 31 rules against the real file.
 *
 * The expected numbers come from surveying `promotion.t8.xlsx` on 2026-08-18,
 * not from whatever the code happens to produce - each one is stated in the
 * phase plan. `promotion.t8.xlsx` holds real business data and is gitignored,
 * so this suite skips itself when the file is absent.
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { beforeAll, describe, expect, it } from 'vitest'
import { readPromotionWorkbook } from '@/lib/excel/promotion-workbook'
import type { WorkbookReadResult } from '@/lib/excel/types'
import { runRules, type RunRulesResult } from '@/lib/rules/engine'
import { mergeRuleConfigs, type RuleConfigInput } from '@/lib/rules/rule-config-store'
import { makeCatalog } from './fixtures'

const REAL_FILE = 'promotion.t8.xlsx'
const hasRealFile = existsSync(REAL_FILE)

/** The day the file was surveyed, so "already started" stays reproducible. */
const NOW = new Date(2026, 7, 18)

describe.skipIf(!hasRealFile)('rule engine on the real promotion.t8.xlsx', () => {
  let workbook: WorkbookReadResult

  const check = (configs: RuleConfigInput[] = mergeRuleConfigs([])): RunRulesResult =>
    runRules({
      workbook,
      // Rules that need the catalog are out of scope here: the point of this
      // test is the file, and the dev store does not carry these 3.929 SKUs.
      catalog: makeCatalog([]),
      haravanPromotions: null,
      now: NOW,
      moneyToleranceVnd: 0.5,
      configs,
    })

  const codesOf = (result: RunRulesResult, code: string) =>
    result.findings.filter((finding) => finding.ruleCode === code)

  beforeAll(async () => {
    workbook = await readPromotionWorkbook(new Uint8Array(await readFile(REAL_FILE)), REAL_FILE)
  })

  it('C2 catches all 279 rows of 2608GST0K and says the program will be refused', () => {
    const findings = codesOf(check(), 'C2')

    expect(findings).toHaveLength(279)
    expect(new Set(findings.map((f) => f.programName))).toEqual(new Set(['2608GST0K']))
    expect(findings.every((f) => f.message.includes('422'))).toBe(true)
    // 275 rows write a literal 0, the remaining 4 leave the cell empty.
    expect(findings.filter((f) => f.message.includes('để trống'))).toHaveLength(4)
  })

  it('A2 lists both sheets, including the two-row percentage sheet', () => {
    const findings = codesOf(check(), 'A2')

    expect(findings.map((f) => f.sheetName)).toEqual(['Key', 'Giảm phần trăm'])
    expect(findings[0].message).toContain('3.929 dòng')
    expect(findings[1].message).toContain('2 dòng')
  })

  it('D4 reports the 01/08 start as already passed', () => {
    const findings = codesOf(check(), 'D4')

    expect(findings.length).toBeGreaterThan(0)
    expect(findings.some((f) => f.message.includes('01/08/2026 đã trôi qua 17 ngày'))).toBe(true)
  })

  it('C1 finds no arithmetic error - the maths in this file is correct', () => {
    expect(codesOf(check(), 'C1')).toHaveLength(0)
  })

  it('E1 and E2 find nothing - no SKU is in two programs at once', () => {
    const result = check()
    expect(codesOf(result, 'E1')).toHaveLength(0)
    expect(codesOf(result, 'E2')).toHaveLength(0)
  })

  it('A4, A5 and B4 find nothing - every row has a well formed SKU', () => {
    const result = check()
    expect(codesOf(result, 'A4')).toHaveLength(0)
    expect(codesOf(result, 'A5')).toHaveLength(0)
    expect(codesOf(result, 'B4')).toHaveLength(0)
  })

  it('switching a rule off removes its findings and lists it as skipped', () => {
    const configs = mergeRuleConfigs([]).map((config) =>
      config.code === 'C2' ? { ...config, enabled: false } : config,
    )
    const result = check(configs)

    expect(codesOf(result, 'C2')).toHaveLength(0)
    expect(result.skippedRules).toContain('C2')
  })

  it('lowering maxDiscountPercent changes how much C4 reports', () => {
    const at = (percent: number) =>
      codesOf(
        check(
          mergeRuleConfigs([]).map((config) =>
            config.code === 'C4' ? { ...config, params: { maxDiscountPercent: percent } } : config,
          ),
        ),
        'C4',
      ).length

    expect(at(70)).toBe(0)
    expect(at(30)).toBeGreaterThan(0)
    expect(at(10)).toBeGreaterThan(at(30))
  })

  it('skips group B and raises SYS-CATALOG-EMPTY rather than flagging 3.929 unknown SKUs', () => {
    const result = check()

    expect(result.skippedRules).toEqual(expect.arrayContaining(['B1', 'B2', 'B3', 'B5', 'B6']))
    expect(codesOf(result, 'B1')).toHaveLength(0)
    expect(codesOf(result, 'SYS-CATALOG-EMPTY')).toHaveLength(1)
  })

  it('runs all 31 rules over 3.931 rows in under 3 seconds', () => {
    const startedAt = performance.now()
    const result = check()
    const elapsed = performance.now() - startedAt

    expect(result.findings.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(3000)
  })

  /**
   * The expensive path: a populated catalog that shares this store's prefixes
   * but none of its codes, so B1 fires on every row and the near-match search
   * has the most work it can ever have. Before the comparison budget this took
   * 83 seconds (measured 2026-08-18).
   */
  it('stays under 3 seconds even when every SKU is unknown to a 59k catalog', () => {
    const fileSkus = [...new Set(workbook.rows.map((row) => row.skuNormalized).filter((s) => s != null))]
    const decoys = fileSkus.flatMap((sku, index) =>
      Array.from({ length: 15 }, (_, k) => ({ sku: `${sku.slice(0, 6)}${index}${k}zz.${k}` })),
    )

    const startedAt = performance.now()
    const result = runRules({
      workbook,
      catalog: makeCatalog(decoys),
      haravanPromotions: null,
      now: NOW,
      moneyToleranceVnd: 0.5,
      configs: mergeRuleConfigs([]),
    })
    const elapsed = performance.now() - startedAt

    expect(result.findings.filter((f) => f.ruleCode === 'B1')).toHaveLength(workbook.rows.length)
    expect(elapsed).toBeLessThan(3000)
  })
})
