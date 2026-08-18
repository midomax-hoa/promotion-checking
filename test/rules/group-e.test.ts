import { describe, expect, it } from 'vitest'
import { e1SkuInOverlappingPrograms } from '@/lib/rules/group-e-overlap/e1-sku-in-overlapping-programs'
import { e2DuplicateSkuInProgram } from '@/lib/rules/group-e-overlap/e2-duplicate-sku-in-program'
import { e3SkuInLiveHaravanPromotion } from '@/lib/rules/group-e-overlap/e3-sku-in-live-haravan-promotion'
import { makePromotion, makeRow, runRule } from './fixtures'

const NOW = new Date(2026, 7, 18)

const sku = (value: string, overrides = {}) =>
  makeRow({ sku: value, skuNormalized: value.toLowerCase(), ...overrides })

describe('E1 - one SKU in two overlapping programs', () => {
  it('names both programs with their windows', () => {
    const rows = [
      sku('A1', { rowNumber: 2, programName: 'P1', startAt: new Date(2026, 7, 1), endAt: new Date(2026, 7, 15) }),
      sku('A1', { rowNumber: 3, programName: 'P2', startAt: new Date(2026, 7, 10), endAt: new Date(2026, 7, 20) }),
    ]
    const findings = runRule(e1SkuInOverlappingPrograms, { rows, now: NOW })

    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('"P1" (01/08/2026 - 15/08/2026, dòng 2)')
    expect(findings[0].message).toContain('"P2" (10/08/2026 - 20/08/2026, dòng 3)')
  })

  it('accepts two programs that do not overlap', () => {
    const rows = [
      sku('A1', { rowNumber: 2, programName: 'P1', startAt: new Date(2026, 7, 1), endAt: new Date(2026, 7, 9) }),
      sku('A1', { rowNumber: 3, programName: 'P2', startAt: new Date(2026, 7, 10), endAt: new Date(2026, 7, 20) }),
    ]
    expect(runRule(e1SkuInOverlappingPrograms, { rows, now: NOW })).toHaveLength(0)
  })

  it('leaves repeats inside one program to E2', () => {
    const rows = [
      sku('A1', { rowNumber: 2, programName: 'P1' }),
      sku('A1', { rowNumber: 3, programName: 'P1' }),
    ]
    expect(runRule(e1SkuInOverlappingPrograms, { rows, now: NOW })).toHaveLength(0)
  })
})

describe('E2 - duplicate SKU inside one program', () => {
  it('points back at the first occurrence and warns about the 422', () => {
    const rows = [
      sku('A1', { rowNumber: 2, programName: 'P1' }),
      sku('A1', { rowNumber: 7, programName: 'P1' }),
    ]
    const findings = runRule(e2DuplicateSkuInProgram, { rows, now: NOW })

    expect(findings).toHaveLength(1)
    expect(findings[0].rowNumber).toBe(7)
    expect(findings[0].message).toContain('đã có ở dòng 2')
    expect(findings[0].message).toContain('422')
  })

  it('matches on the normalised SKU, so casing and spaces still collide', () => {
    const rows = [
      makeRow({ rowNumber: 2, programName: 'P1', sku: 'A1', skuNormalized: 'a1' }),
      makeRow({ rowNumber: 3, programName: 'P1', sku: ' a1 ', skuNormalized: 'a1' }),
    ]
    expect(runRule(e2DuplicateSkuInProgram, { rows, now: NOW })).toHaveLength(1)
  })

  it('accepts the same SKU in two different programs', () => {
    const rows = [
      sku('A1', { rowNumber: 2, programName: 'P1' }),
      sku('A1', { rowNumber: 3, programName: 'P2' }),
    ]
    expect(runRule(e2DuplicateSkuInProgram, { rows, now: NOW })).toHaveLength(0)
  })
})

describe('E3 - SKU already in a live Haravan promotion', () => {
  const rows = [sku('A1', { programName: 'P1', startAt: new Date(2026, 7, 1), endAt: new Date(2026, 7, 31) })]

  it('names the clashing promotion', () => {
    const findings = runRule(e3SkuInLiveHaravanPromotion, {
      rows,
      now: NOW,
      haravanPromotions: [makePromotion({ name: 'Sale hè', skus: ['a1'] })],
    })
    expect(findings[0].message).toContain('"Sale hè"')
  })

  it('ignores an inactive promotion', () => {
    const findings = runRule(e3SkuInLiveHaravanPromotion, {
      rows,
      now: NOW,
      haravanPromotions: [makePromotion({ name: 'Sale hè', skus: ['a1'], active: false })],
    })
    expect(findings).toHaveLength(0)
  })

  it('ignores a promotion outside the row window', () => {
    const findings = runRule(e3SkuInLiveHaravanPromotion, {
      rows,
      now: NOW,
      haravanPromotions: [
        makePromotion({
          name: 'Sale xuân',
          skus: ['a1'],
          startAt: new Date(2026, 0, 1),
          endAt: new Date(2026, 0, 31),
        }),
      ],
    })
    expect(findings).toHaveLength(0)
  })

  it('does not report the program this file is about to create', () => {
    const findings = runRule(e3SkuInLiveHaravanPromotion, {
      rows,
      now: NOW,
      haravanPromotions: [makePromotion({ name: 'P1', skus: ['a1'] })],
    })
    expect(findings).toHaveLength(0)
  })

  it('is skipped when the promotion list was never fetched', () => {
    expect(runRule(e3SkuInLiveHaravanPromotion, { rows, now: NOW, haravanPromotions: null })).toHaveLength(0)
  })
})
