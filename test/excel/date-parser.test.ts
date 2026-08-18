import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseExcelDate } from '@/lib/excel/date-parser'

/** Local-calendar assertion - never compares instants, which is the whole point. */
function expectDay(raw: unknown, year: number, month: number, day: number) {
  const parsed = parseExcelDate(raw)
  expect(parsed.ok, `expected ${String(raw)} to parse`).toBe(true)
  if (!parsed.ok) return
  expect([
    parsed.value.getFullYear(),
    parsed.value.getMonth() + 1,
    parsed.value.getDate(),
  ]).toEqual([year, month, day])
}

describe('parseExcelDate - Excel serial numbers', () => {
  it('reads 46235 as 2026-08-01, the value in the sample file', () => {
    expectDay(46235, 2026, 8, 1)
    expectDay(46265, 2026, 8, 31)
  })

  it('reports the source so callers can tell how a value was understood', () => {
    const parsed = parseExcelDate(46235)
    expect(parsed.ok && parsed.source).toBe('serial')
  })

  it('keeps the time of day carried by the fractional part', () => {
    const parsed = parseExcelDate(46235.5)
    expect(parsed.ok && parsed.value.getHours()).toBe(12)
  })

  it('rejects serials outside the range Excel can represent', () => {
    expect(parseExcelDate(0).ok).toBe(false)
    expect(parseExcelDate(-5).ok).toBe(false)
    expect(parseExcelDate(9_999_999).ok).toBe(false)
    expect(parseExcelDate(Number.NaN).ok).toBe(false)
  })
})

describe('parseExcelDate - Date objects from exceljs', () => {
  it('keeps the calendar day exceljs encoded at UTC midnight', () => {
    expectDay(new Date('2026-08-01T00:00:00.000Z'), 2026, 8, 1)
  })

  it('rejects an invalid Date instead of passing NaN downstream', () => {
    expect(parseExcelDate(new Date('nonsense')).ok).toBe(false)
  })
})

/**
 * The regression this phase exists to prevent. exceljs hands back UTC midnight;
 * read with `getDate()` west of Greenwich that is the previous day, so a
 * promotion would start 24h early. Both input paths are checked, because the
 * serial path and the Date path each do their own conversion.
 */
describe('parseExcelDate - timezone safety', () => {
  const originalTz = process.env.TZ

  beforeAll(() => {
    process.env.TZ = 'America/New_York' // UTC-4 in August: the worst case.
  })
  afterAll(() => {
    process.env.TZ = originalTz
  })

  it('proves the hazard is real - naive reading loses a day', () => {
    expect(new Date(Date.UTC(2026, 7, 1)).getDate()).toBe(31)
  })

  it('still yields 2026-08-01 from a serial', () => {
    expectDay(46235, 2026, 8, 1)
  })

  it('still yields 2026-08-01 from a UTC-midnight Date', () => {
    expectDay(new Date('2026-08-01T00:00:00.000Z'), 2026, 8, 1)
  })

  it('leaves an explicit local string alone', () => {
    expectDay('2026-08-01', 2026, 8, 1)
  })
})

describe('parseExcelDate - strings', () => {
  it('accepts YYYY-MM-DD with and without a time', () => {
    expectDay('2026-08-01', 2026, 8, 1)
    expectDay('2026-08-01 13:45:00', 2026, 8, 1)
    expectDay('2026-08-01T13:45:00', 2026, 8, 1)
    const parsed = parseExcelDate('2026-08-01 13:45:30')
    expect(parsed.ok && [parsed.value.getHours(), parsed.value.getMinutes()]).toEqual([13, 45])
    expect(parsed.ok && parsed.source).toBe('iso-string')
  })

  it('reads D/M/YYYY day-first, the order used in Vietnamese files', () => {
    expectDay('1/8/2026', 2026, 8, 1)
    expectDay('31/12/2025', 2025, 12, 31)
    const parsed = parseExcelDate('1/8/2026')
    expect(parsed.ok && parsed.source).toBe('dmy-string')
  })

  it('rejects a day that does not exist rather than rolling into next month', () => {
    expect(parseExcelDate('31/02/2026').ok).toBe(false)
    expect(parseExcelDate('2026-02-31').ok).toBe(false)
    expect(parseExcelDate('2026-13-01').ok).toBe(false)
  })
})

describe('parseExcelDate - unreadable input has no fallback', () => {
  it.each([
    ['blank', ''],
    ['whitespace', '   '],
    ['free text', 'tháng 8'],
    ['month-name format', 'Aug 1, 2026'],
    ['null', null],
    ['undefined', undefined],
    ['boolean', true],
    ['formula error', { error: '#N/A' }],
  ])('returns ok:false for %s and never a default date', (_label, raw) => {
    const parsed = parseExcelDate(raw)
    expect(parsed.ok).toBe(false)
    expect(parsed).not.toHaveProperty('value')
  })
})

describe('parseExcelDate - exceljs wrappers', () => {
  it('reads through a formula cell to its cached result', () => {
    expectDay({ formula: 'L2+30', result: new Date('2026-08-31T00:00:00.000Z') }, 2026, 8, 31)
    expectDay({ sharedFormula: 'L2', result: 46235 }, 2026, 8, 1)
  })
})
