import { describe, expect, it, vi } from 'vitest'
import { reconcile } from '@/lib/reconcile/reconcile-engine'
import type { RawHaravanPromotion } from '@/lib/haravan/promotion-types'
import {
  SYSTEM_RECONCILE_AMBIGUOUS,
  SYSTEM_RECONCILE_DISAGREED,
} from '@/lib/rules/rule-catalog'
import { makeRow, makeWorkbook } from '../rules/fixtures'
import {
  makeRawPromotion,
  reconcileConfigs,
  TWO_VARIANT_CATALOG,
  VN_OFFSET_MINUTES,
} from './fixtures'

const WORKBOOK = makeWorkbook([
  makeRow({ programName: '2608GST10K', sku: 'SKU1' }),
  makeRow({ programName: '2608GST10K', sku: 'SKU2' }),
])

const OPTIONS = {
  recheckDelayMs: 8000,
  shopTimezoneOffsetMinutes: VN_OFFSET_MINUTES,
  moneyToleranceVnd: 0.5,
  configs: reconcileConfigs(),
}

/** Answers with a different list per pass, so index lag can be simulated exactly. */
function passes(...perPass: RawHaravanPromotion[][]) {
  return (pass: 1 | 2) => Promise.resolve(perPass[pass - 1] ?? [])
}

describe('two-pass reconciliation', () => {
  it('skips the wait entirely when the first pass finds everything', async () => {
    const sleep = vi.fn(async () => undefined)
    const fetchPromotions = vi.fn(passes([makeRawPromotion()], [makeRawPromotion()]))

    const result = await reconcile(WORKBOOK, OPTIONS, {
      catalog: TWO_VARIANT_CATALOG,
      fetchPromotions,
      sleep,
    })

    expect(result.passesRun).toBe(1)
    expect(fetchPromotions).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
    expect(result.passesAgreed).toBe(true)
  })

  /**
   * The whole reason the mechanism exists: Haravan's list lags a few seconds
   * behind a create, so a program the first pass cannot see is not missing.
   */
  it('does not report F1 for a program that only shows up on the second pass', async () => {
    const result = await reconcile(WORKBOOK, OPTIONS, {
      catalog: TWO_VARIANT_CATALOG,
      fetchPromotions: passes([], [makeRawPromotion()]),
      sleep: async () => undefined,
    })

    expect(result.passesRun).toBe(2)
    expect(result.findings.some((finding) => finding.ruleCode === 'F1')).toBe(false)
  })

  it('flags the disagreement so the screen can suggest running again', async () => {
    const result = await reconcile(WORKBOOK, OPTIONS, {
      catalog: TWO_VARIANT_CATALOG,
      fetchPromotions: passes([], [makeRawPromotion()]),
      sleep: async () => undefined,
    })

    expect(result.passesAgreed).toBe(false)
    expect(result.findings.some((f) => f.ruleCode === SYSTEM_RECONCILE_DISAGREED)).toBe(true)
  })

  it('reports F1 when both passes agree the program is missing', async () => {
    const sleep = vi.fn(async () => undefined)
    const result = await reconcile(WORKBOOK, OPTIONS, {
      catalog: TWO_VARIANT_CATALOG,
      fetchPromotions: passes([], []),
      sleep,
    })

    expect(sleep).toHaveBeenCalledWith(8000)
    expect(result.passesAgreed).toBe(true)
    const f1 = result.findings.filter((finding) => finding.ruleCode === 'F1')
    expect(f1).toHaveLength(1)
    expect(f1[0].programName).toBe('2608GST10K')
    expect(f1[0].severity).toBe('critical')
  })

  it('waits exactly the configured delay', async () => {
    const sleep = vi.fn(async () => undefined)
    await reconcile(
      WORKBOOK,
      { ...OPTIONS, recheckDelayMs: 1234 },
      { catalog: TWO_VARIANT_CATALOG, fetchPromotions: passes([], []), sleep },
    )
    expect(sleep).toHaveBeenCalledWith(1234)
  })

  it('narrates each phase', async () => {
    const phases: string[] = []
    await reconcile(WORKBOOK, OPTIONS, {
      catalog: TWO_VARIANT_CATALOG,
      fetchPromotions: passes([], []),
      sleep: async () => undefined,
      onProgress: (progress) => phases.push(progress.phase),
    })
    expect(phases).toEqual(['pass-1', 'waiting', 'pass-2', 'rules'])
  })
})

describe('duplicate names', () => {
  it('draws no conclusion, and lists every candidate instead', async () => {
    const result = await reconcile(WORKBOOK, OPTIONS, {
      catalog: TWO_VARIANT_CATALOG,
      fetchPromotions: passes([
        makeRawPromotion({ id: 1 }),
        makeRawPromotion({ id: 2, value: 99_000 }),
      ]),
      sleep: async () => undefined,
    })

    // F2 would otherwise scream about the 99.000d one.
    expect(result.findings.some((finding) => finding.ruleCode.startsWith('F'))).toBe(false)
    const ambiguous = result.findings.find((f) => f.ruleCode === SYSTEM_RECONCILE_AMBIGUOUS)
    expect(ambiguous?.message).toContain('#1')
    expect(ambiguous?.message).toContain('#2')
  })
})

describe('rule configuration', () => {
  it('skips a rule that is switched off rather than running it', async () => {
    const result = await reconcile(
      WORKBOOK,
      { ...OPTIONS, configs: reconcileConfigs({ F1: { enabled: false } }) },
      {
        catalog: TWO_VARIANT_CATALOG,
        fetchPromotions: passes([], []),
        sleep: async () => undefined,
      },
    )

    expect(result.skippedRules).toContain('F1')
    expect(result.findings.some((finding) => finding.ruleCode === 'F1')).toBe(false)
  })

  it('applies the configured severity', async () => {
    const result = await reconcile(
      WORKBOOK,
      { ...OPTIONS, configs: reconcileConfigs({ F1: { severity: 'warn' } }) },
      {
        catalog: TWO_VARIANT_CATALOG,
        fetchPromotions: passes([], []),
        sleep: async () => undefined,
      },
    )

    expect(result.findings.find((finding) => finding.ruleCode === 'F1')?.severity).toBe('warn')
    expect(result.counts.critical).toBe(0)
  })
})
