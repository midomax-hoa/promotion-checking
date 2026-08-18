import { describe, expect, it } from 'vitest'
import { daysBetween, formatDate, startOfDay, windowsOverlap } from '@/lib/rules/helpers/date-range'
import {
  buildSimilarityIndex,
  findClosest,
  isBudgetExhausted,
  levenshtein,
} from '@/lib/rules/helpers/levenshtein'
import { discountFraction, formatPercent, formatVnd, moneyEquals } from '@/lib/rules/helpers/money'
import { parseProgramName } from '@/lib/rules/group-d-program/program-name'

describe('levenshtein', () => {
  it('measures edit distance', () => {
    expect(levenshtein('abc', 'abc', 2)).toBe(0)
    expect(levenshtein('abc', 'abd', 2)).toBe(1)
    expect(levenshtein('abc', 'ab', 2)).toBe(1)
    expect(levenshtein('kitten', 'sitting', 5)).toBe(3)
  })

  it('gives up rather than computing a distance above the budget', () => {
    expect(levenshtein('abcdef', 'zzzzzz', 2)).toBe(3)
    expect(levenshtein('a', 'aaaaaaaa', 2)).toBe(3)
  })
})

describe('findClosest', () => {
  const index = buildSimilarityIndex(['kmap231728f.xl', 'kmap231728f.l', 'kmtf240645.44'])

  it('suggests the nearest SKU within the budget', () => {
    expect(findClosest(index, 'kmap231728f.xxl', 2)).toBe('kmap231728f.xl')
  })

  it('returns null when nothing shares the leading characters', () => {
    expect(findClosest(index, 'zzz231728f.xl', 2)).toBeNull()
  })

  it('returns null when the nearest candidate is too far', () => {
    expect(findClosest(index, 'kmap999999z.qqqq', 2)).toBeNull()
  })

  it('spends budget per candidate examined', () => {
    const budgeted = buildSimilarityIndex(['kmap231728f.xl', 'kmap231728f.l'], 10)
    findClosest(budgeted, 'kmap231728f.xxl', 2)
    expect(budgeted.budget).toBeLessThan(10)
  })

  it('stops searching, rather than slowing down, once the budget is gone', () => {
    const spent = buildSimilarityIndex(['kmap231728f.xl'], 0)
    expect(isBudgetExhausted(spent)).toBe(true)
    expect(findClosest(spent, 'kmap231728f.xxl', 2)).toBeNull()
  })
})

describe('money', () => {
  it('compares within tolerance', () => {
    expect(moneyEquals(100_000, 100_000.4, 0.5)).toBe(true)
    expect(moneyEquals(100_000, 100_001, 0.5)).toBe(false)
  })

  it('formats đồng with a dot separator', () => {
    expect(formatVnd(1_485_000)).toBe('1.485.000đ')
    expect(formatVnd(0)).toBe('0đ')
    expect(formatVnd(-2000)).toBe('-2.000đ')
  })

  it('formats a decimal fraction as a percentage', () => {
    expect(formatPercent(0.5)).toBe('50%')
    expect(formatPercent(0.075)).toBe('7.5%')
  })

  it('refuses to divide by a missing or zero list price', () => {
    expect(discountFraction(null, 10)).toBeNull()
    expect(discountFraction(0, 10)).toBeNull()
    expect(discountFraction(100, 70)).toBeCloseTo(0.7)
  })
})

describe('date range', () => {
  it('counts whole days regardless of time of day', () => {
    expect(daysBetween(new Date(2026, 7, 1, 23), new Date(2026, 7, 3, 1))).toBe(2)
    expect(daysBetween(new Date(2026, 7, 3), new Date(2026, 7, 1))).toBe(-2)
  })

  it('treats a shared boundary day as an overlap', () => {
    const a = { start: new Date(2026, 7, 1), end: new Date(2026, 7, 10) }
    const b = { start: new Date(2026, 7, 10), end: new Date(2026, 7, 20) }
    const c = { start: new Date(2026, 7, 11), end: new Date(2026, 7, 20) }
    expect(windowsOverlap(a, b)).toBe(true)
    expect(windowsOverlap(a, c)).toBe(false)
  })

  it('treats a missing end date as open ended', () => {
    expect(
      windowsOverlap(
        { start: new Date(2026, 0, 1), end: null },
        { start: new Date(2030, 0, 1), end: null },
      ),
    ).toBe(true)
  })

  it('formats dates the way the file writes them', () => {
    expect(formatDate(new Date(2026, 7, 1))).toBe('01/08/2026')
    expect(startOfDay(new Date(2026, 7, 1, 18, 30)).getHours()).toBe(0)
  })
})

describe('parseProgramName', () => {
  it('reads the YYMM prefix and the trailing value', () => {
    expect(parseProgramName('2608GST130K')).toEqual({
      year: 2026,
      month: 8,
      amount: 130_000,
      percent: null,
    })
    expect(parseProgramName('2510GPT50%')).toEqual({
      year: 2025,
      month: 10,
      amount: null,
      percent: 0.5,
    })
  })

  it('reports nulls for a name that does not follow the convention', () => {
    expect(parseProgramName('Khuyến mãi hè')).toEqual({
      year: null,
      month: null,
      amount: null,
      percent: null,
    })
  })

  it('rejects an impossible month rather than guessing', () => {
    expect(parseProgramName('2699GST10K').month).toBeNull()
  })
})
