import { describe, expect, it } from 'vitest'
import { GROUP_F_RULES, GROUP_F_RULES_BY_CODE } from '@/lib/reconcile/group-f-reconcile'
import { matchPrograms } from '@/lib/reconcile/promotion-matcher'
import { RULE_CATALOG } from '@/lib/rules/rule-catalog'
import { mergeRuleConfigs } from '@/lib/rules/rule-config-store'
import type { RuleFinding } from '@/lib/rules/types'
import type { MatchResult } from '@/lib/reconcile/types'
import type { RawHaravanPromotion } from '@/lib/haravan/promotion-types'
import { makeRow, makeWorkbook } from '../rules/fixtures'
import {
  makeReconcileCatalog,
  makeReconcilePromotion,
  TWO_VARIANT_CATALOG,
  VN_OFFSET_MINUTES,
} from './fixtures'

/** Runs one group F rule with the catalog defaults for its params. */
function runRule(
  code: string,
  matches: readonly MatchResult[],
  catalog = TWO_VARIANT_CATALOG,
): RuleFinding[] {
  const rule = GROUP_F_RULES_BY_CODE.get(code)
  if (rule == null) throw new Error(`Chưa hiện thực luật ${code}`)
  const config = mergeRuleConfigs([]).find((entry) => entry.code === code)
  return rule.run({
    matches,
    catalog,
    moneyToleranceVnd: 0.5,
    shopTimezoneOffsetMinutes: VN_OFFSET_MINUTES,
    params: config?.params ?? {},
  })
}

/** One Excel program lined up against zero or more Haravan promotions. */
function build(
  rows: Parameters<typeof makeRow>[0][],
  raws: Partial<RawHaravanPromotion>[],
  catalog = TWO_VARIANT_CATALOG,
): MatchResult[] {
  const workbook = makeWorkbook(rows.map((overrides) => makeRow(overrides)))
  return matchPrograms(
    workbook,
    raws.map((raw) => makeReconcilePromotion(raw, catalog)),
    { shopTimezoneOffsetMinutes: VN_OFFSET_MINUTES },
  )
}

describe('group F registry', () => {
  it('implements every catalogued F rule', () => {
    const catalogued = RULE_CATALOG.filter((rule) => rule.groupCode === 'F').map((r) => r.code)
    expect(GROUP_F_RULES.map((rule) => rule.code)).toEqual(catalogued)
  })
})

describe('F1 - program not found', () => {
  it('reports a program with nothing on Haravan', () => {
    const findings = runRule('F1', build([{ programName: 'Chưa import' }], []))
    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('Chưa import')
  })

  it('says nothing when the program is there', () => {
    expect(runRule('F1', build([{ programName: '2608GST10K' }], [{}]))).toEqual([])
  })
})

describe('F2 - discount value', () => {
  it('reports a different amount', () => {
    const findings = runRule('F2', build([{ programName: '2608GST10K' }], [{ value: 20_000 }]))
    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('10.000đ')
    expect(findings[0].message).toContain('20.000đ')
  })

  it('accepts a difference inside the money tolerance', () => {
    expect(runRule('F2', build([{ programName: '2608GST10K' }], [{ value: 10_000.4 }]))).toEqual([])
  })

  /** The file stores 0.5, Haravan stores 50; comparing them raw would always fail. */
  it('compares a percentage after scaling the file value', () => {
    const rows = [
      {
        programName: 'GIAM50',
        discountType: 'percentage' as const,
        discountPercent: 0.5,
        discountAmount: null,
      },
    ]
    expect(
      runRule('F2', build(rows, [{ name: 'GIAM50', take_type: 'percentage', value: 50 }])),
    ).toEqual([])

    const wrong = runRule('F2', build(rows, [{ name: 'GIAM50', take_type: 'percentage', value: 15 }]))
    expect(wrong).toHaveLength(1)
    expect(wrong[0].message).toContain('50%')
    expect(wrong[0].message).toContain('15%')
  })

  /** 50.000d that became 50% holds the same number on both sides. */
  it('catches a swapped discount kind even when the numbers agree', () => {
    const findings = runRule(
      'F2',
      build(
        [{ programName: 'GIAM', discountAmount: 50, discountType: 'fixed_amount' as const }],
        [{ name: 'GIAM', take_type: 'percentage', value: 50 }],
      ),
    )
    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('giảm phần trăm')
  })

  it('stays silent when the file disagrees with itself', () => {
    const rows = [
      { programName: 'X', discountAmount: 10_000 },
      { programName: 'X', discountAmount: 20_000 },
    ]
    expect(runRule('F2', build(rows, [{ name: 'X', value: 30_000 }]))).toEqual([])
  })
})

describe('F3 - dates', () => {
  it('does not report the UTC+7 conversion as a difference', () => {
    const findings = runRule(
      'F3',
      build(
        [{ programName: 'X', startAt: new Date(2020, 0, 1), endAt: null }],
        [{ name: 'X', starts_at: '2019-12-31T17:00:00Z', ends_at: null }],
      ),
    )
    expect(findings).toEqual([])
  })

  it('reports a real shift', () => {
    const findings = runRule(
      'F3',
      build(
        [{ programName: 'X', startAt: new Date(2020, 0, 1), endAt: null }],
        [{ name: 'X', starts_at: '2020-01-01T17:00:00Z', ends_at: null }],
      ),
    )
    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('02/01/2020')
  })

  it('reports a promotion the file ends but Haravan does not', () => {
    const findings = runRule(
      'F3',
      build(
        [{ programName: 'X', startAt: new Date(2026, 7, 1), endAt: new Date(2026, 7, 31) }],
        [{ name: 'X', starts_at: '2026-07-31T17:00:00Z', ends_at: null }],
      ),
    )
    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('vô thời hạn')
  })

  it('says nothing about a date the file never stated', () => {
    const findings = runRule(
      'F3',
      build(
        [{ programName: 'X', startAt: new Date(2026, 7, 1), endAt: null }],
        [{ name: 'X', starts_at: '2026-07-31T17:00:00Z', ends_at: '2026-08-30T17:00:00Z' }],
      ),
    )
    expect(findings).toEqual([])
  })
})

describe('F4 - disabled', () => {
  it('reports a promotion that is switched off', () => {
    const findings = runRule('F4', build([{ programName: 'X' }], [{ name: 'X', status: 'disabled' }]))
    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('disabled')
  })

  it('says nothing about a running one', () => {
    expect(runRule('F4', build([{ programName: 'X' }], [{ name: 'X' }]))).toEqual([])
  })
})

describe('F5 - attached SKU count', () => {
  it('reports a program Haravan received fewer variants for', () => {
    const findings = runRule(
      'F5',
      build(
        [
          { programName: 'X', sku: 'SKU1' },
          { programName: 'X', sku: 'SKU2' },
        ],
        [{ name: 'X', entitled_variant_ids: [1] }],
      ),
    )
    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('Thiếu 1')
  })

  it('counts distinct SKUs, so a duplicated row is not a shortfall', () => {
    const findings = runRule(
      'F5',
      build(
        [
          { programName: 'X', sku: 'SKU1' },
          { programName: 'X', sku: 'SKU1' },
        ],
        [{ name: 'X', entitled_variant_ids: [1] }],
      ),
    )
    expect(findings).toEqual([])
  })

  /** The dev-store shape: nothing in entitled_variant_ids, products instead. */
  it('does not accuse a promotion that attaches whole products', () => {
    const catalog = makeReconcileCatalog([
      { variantId: 1, productId: 10, sku: 'SKU1' },
      { variantId: 2, productId: 10, sku: 'SKU2' },
    ])
    const findings = runRule(
      'F5',
      build(
        [
          { programName: 'X', sku: 'SKU1' },
          { programName: 'X', sku: 'SKU2' },
        ],
        [{ name: 'X', entitled_variant_ids: [], entitled_product_ids: [10] }],
        catalog,
      ),
      catalog,
    )
    expect(findings).toEqual([])
  })

  it('stays silent when the attachment cannot be resolved', () => {
    const empty = makeReconcileCatalog([], null)
    const findings = runRule(
      'F5',
      build(
        [{ programName: 'X', sku: 'SKU1' }],
        [{ name: 'X', entitled_variant_ids: [], entitled_product_ids: [10] }],
        empty,
      ),
      empty,
    )
    expect(findings).toEqual([])
  })
})

describe('F6 - extra on Haravan', () => {
  it('reports an overlapping promotion the file does not have', () => {
    const matches = build(
      [{ programName: 'X', startAt: new Date(2026, 7, 1), endAt: new Date(2026, 7, 31) }],
      [{ name: 'X' }, { id: 9, name: 'Tạo tay' }],
    )
    const findings = runRule('F6', matches)
    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('Tạo tay')
  })
})
