import { describe, expect, it } from 'vitest'
import {
  matchPrograms,
  normalizeProgramName,
  notFoundNames,
  workbookWindow,
} from '@/lib/reconcile/promotion-matcher'
import { makeRow, makeWorkbook } from '../rules/fixtures'
import { makeReconcilePromotion, VN_OFFSET_MINUTES } from './fixtures'

const OPTIONS = { shopTimezoneOffsetMinutes: VN_OFFSET_MINUTES }

describe('normalizeProgramName', () => {
  it('ignores case, edge spaces and repeated inner spaces', () => {
    expect(normalizeProgramName('  2608GST10K  ')).toBe('2608gst10k')
    expect(normalizeProgramName('Giảm   sốc  hè')).toBe('giảm sốc hè')
  })

  it('turns a missing name into an empty key rather than throwing', () => {
    expect(normalizeProgramName(null)).toBe('')
  })
})

describe('workbookWindow', () => {
  it('spans the widest range the rows describe', () => {
    const workbook = makeWorkbook([
      makeRow({ startAt: new Date(2026, 7, 1), endAt: new Date(2026, 7, 10) }),
      makeRow({ startAt: new Date(2026, 6, 15), endAt: new Date(2026, 7, 31) }),
    ])
    expect(workbookWindow(workbook)).toEqual({
      start: new Date(2026, 6, 15),
      end: new Date(2026, 7, 31),
    })
  })

  it('leaves a side open when any row leaves it open', () => {
    const workbook = makeWorkbook([
      makeRow({ startAt: new Date(2026, 7, 1), endAt: null }),
      makeRow({ startAt: new Date(2026, 7, 1), endAt: new Date(2026, 7, 10) }),
    ])
    expect(workbookWindow(workbook).end).toBeNull()
  })
})

describe('matchPrograms', () => {
  it('matches one program to one promotion', () => {
    const workbook = makeWorkbook([makeRow({ programName: '2608GST10K' })])
    const matches = matchPrograms(workbook, [makeReconcilePromotion()], OPTIONS)

    expect(matches).toHaveLength(1)
    expect(matches[0].status).toBe('matched')
    expect(matches[0].haravanMatches).toHaveLength(1)
  })

  it('matches despite case and spacing differences', () => {
    const workbook = makeWorkbook([makeRow({ programName: ' 2608gst10k ' })])
    const matches = matchPrograms(workbook, [makeReconcilePromotion({ name: '2608GST10K' })], OPTIONS)
    expect(matches[0].status).toBe('matched')
  })

  it('reports a program with nothing on Haravan as not-found', () => {
    const workbook = makeWorkbook([makeRow({ programName: 'Chưa import' })])
    const matches = matchPrograms(workbook, [makeReconcilePromotion()], OPTIONS)
    expect(matches[0].status).toBe('not-found')
    expect(matches[0].haravanMatches).toEqual([])
  })

  /** Haravan allows duplicate names, so the tool must list them, not choose one. */
  it('lists every candidate when the name is duplicated', () => {
    const workbook = makeWorkbook([makeRow({ programName: '2608GST10K' })])
    const matches = matchPrograms(
      workbook,
      [makeReconcilePromotion({ id: 1 }), makeReconcilePromotion({ id: 2, value: 20_000 })],
      OPTIONS,
    )

    expect(matches[0].status).toBe('ambiguous')
    expect(matches[0].haravanMatches.map((p) => p.id)).toEqual(['1', '2'])
  })

  it('reports an overlapping promotion the file does not have', () => {
    const workbook = makeWorkbook([
      makeRow({ programName: '2608GST10K', startAt: new Date(2026, 7, 1), endAt: new Date(2026, 7, 31) }),
    ])
    const matches = matchPrograms(
      workbook,
      [makeReconcilePromotion(), makeReconcilePromotion({ id: 9, name: 'Khuyến mãi tay' })],
      OPTIONS,
    )

    const extra = matches.find((match) => match.status === 'extra-on-haravan')
    expect(extra?.programName).toBe('Khuyến mãi tay')
    expect(extra?.expectation).toBeNull()
  })

  it('ignores a promotion whose window is nowhere near the file', () => {
    const workbook = makeWorkbook([
      makeRow({ programName: '2608GST10K', startAt: new Date(2026, 7, 1), endAt: new Date(2026, 7, 31) }),
    ])
    const old = makeReconcilePromotion({
      id: 9,
      name: 'Tết 2020',
      starts_at: '2019-12-31T17:00:00Z',
      ends_at: '2020-01-31T17:00:00Z',
    })
    const matches = matchPrograms(workbook, [makeReconcilePromotion(), old], OPTIONS)
    expect(matches.some((match) => match.status === 'extra-on-haravan')).toBe(false)
  })
})

describe('notFoundNames', () => {
  it('collects the normalised names nothing matched', () => {
    const workbook = makeWorkbook([makeRow({ programName: ' Chưa Import ' })])
    const names = notFoundNames(matchPrograms(workbook, [], OPTIONS))
    expect([...names]).toEqual(['chưa import'])
  })
})
