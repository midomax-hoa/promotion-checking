import { describe, expect, it } from 'vitest'
import {
  compareTimestamps,
  formatWallClock,
  parseHaravanInstant,
  shopLocalDay,
  shopWallClockOf,
  workbookWallClock,
} from '@/lib/reconcile/shop-time'
import { VN_OFFSET_MINUTES } from './fixtures'

/**
 * The case named in the phase plan, and the reason this module exists at all:
 * `2019-12-31T17:00:00Z` and `01/01/2020` are the same moment for a shop at
 * UTC+7. A comparison that misses that reports every date in a correct import
 * as wrong.
 *
 * These assertions must hold whatever timezone the machine running them is in,
 * which is why nothing here builds a Date from an ISO string with a zone and
 * then reads local fields off it.
 */
describe('shop wall clock', () => {
  it('reads a UTC instant as the shop sees it', () => {
    const clock = shopWallClockOf(new Date('2019-12-31T17:00:00Z'), VN_OFFSET_MINUTES)
    expect(clock).toEqual({ year: 2020, month: 1, day: 1, hour: 0, minute: 0 })
  })

  it('reads a workbook date from its own calendar fields', () => {
    expect(workbookWallClock(new Date(2020, 0, 1))).toEqual({
      year: 2020,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
    })
  })

  it('parses a Haravan timestamp and rejects an unreadable one', () => {
    expect(parseHaravanInstant('2026-07-22T08:11:00Z')?.toISOString()).toBe(
      '2026-07-22T08:11:00.000Z',
    )
    expect(parseHaravanInstant('không phải ngày')).toBeNull()
    expect(parseHaravanInstant(null)).toBeNull()
  })
})

describe('compareTimestamps', () => {
  it('does not report a difference for 2019-12-31T17:00Z against 01/01/2020', () => {
    const result = compareTimestamps(
      new Date(2020, 0, 1),
      new Date('2019-12-31T17:00:00Z'),
      VN_OFFSET_MINUTES,
    )
    expect(result.equal).toBe(true)
    expect(formatWallClock(result.haravan)).toBe('01/01/2020')
  })

  it('reports a real one-day difference', () => {
    const result = compareTimestamps(
      new Date(2020, 0, 1),
      new Date('2020-01-01T17:00:00Z'),
      VN_OFFSET_MINUTES,
    )
    expect(result.equal).toBe(false)
    expect(formatWallClock(result.haravan)).toBe('02/01/2020')
  })

  it('compares to the minute, not to the day', () => {
    const result = compareTimestamps(
      new Date(2020, 0, 1, 0, 0),
      new Date('2019-12-31T17:30:00Z'),
      VN_OFFSET_MINUTES,
    )
    expect(result.equal).toBe(false)
  })

  it('treats a missing value on one side as a difference', () => {
    expect(compareTimestamps(new Date(2020, 0, 1), null, VN_OFFSET_MINUTES).equal).toBe(false)
    expect(compareTimestamps(null, new Date('2020-01-01T00:00:00Z'), VN_OFFSET_MINUTES).equal).toBe(
      false,
    )
  })

  it('treats both sides missing as agreement', () => {
    expect(compareTimestamps(null, null, VN_OFFSET_MINUTES).equal).toBe(true)
  })

  it('works for a shop behind UTC as well', () => {
    // UTC-5: 2020-01-01T05:00Z is midnight local.
    const result = compareTimestamps(new Date(2020, 0, 1), new Date('2020-01-01T05:00:00Z'), -300)
    expect(result.equal).toBe(true)
  })
})

describe('shopLocalDay', () => {
  it('places an instant on the shop calendar day', () => {
    const day = shopLocalDay(new Date('2019-12-31T17:00:00Z'), VN_OFFSET_MINUTES)
    expect(day).toEqual(new Date(2020, 0, 1))
  })

  it('passes null through', () => {
    expect(shopLocalDay(null, VN_OFFSET_MINUTES)).toBeNull()
  })
})

describe('formatWallClock', () => {
  it('drops the time when it is midnight', () => {
    expect(formatWallClock({ year: 2026, month: 8, day: 1, hour: 0, minute: 0 })).toBe('01/08/2026')
  })

  it('keeps the time when it is not', () => {
    expect(formatWallClock({ year: 2026, month: 8, day: 1, hour: 15, minute: 11 })).toBe(
      '01/08/2026 15:11',
    )
  })

  it('says so when there is nothing', () => {
    expect(formatWallClock(null)).toBe('(không có)')
  })
})
