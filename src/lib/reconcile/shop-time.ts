/**
 * The one place a Haravan instant is lined up against an Excel date.
 *
 * The two sides are not the same kind of value, which is the whole problem:
 *   - Haravan returns a UTC instant, `2019-12-31T17:00:00Z`
 *   - the workbook reader returns a Date built from calendar fields,
 *     `new Date(2020, 0, 1)`, i.e. midnight in whatever zone the server runs in
 *
 * Those describe the same moment for a shop at UTC+7 and different moments
 * anywhere else. Comparing them with `getTime()` therefore reports every single
 * date as wrong the moment the server's zone is not the shop's - which is how
 * rule F3 would flag a perfectly correct import from top to bottom.
 *
 * So neither side is compared as an instant. Both are reduced to a wall clock:
 * the Excel date through its own calendar fields (the same fields it was built
 * from, so the server zone cancels out), the Haravan instant by shifting it by
 * the shop's offset. The result is independent of where this code runs.
 *
 * The offset comes from AppSetting `shop.timezone_offset_minutes`, never from a
 * literal here and never from `Date.getTimezoneOffset()`.
 */

const MS_PER_MINUTE = 60_000

/** Year, month, day, hour and minute - the fields a human would read off a clock. */
export type WallClock = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

/** Wall clock of a UTC instant, seen from a shop `offsetMinutes` ahead of UTC. */
export function shopWallClockOf(instant: Date, offsetMinutes: number): WallClock {
  const shifted = new Date(instant.getTime() + offsetMinutes * MS_PER_MINUTE)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  }
}

/**
 * Wall clock of a workbook date, read back from the calendar fields it was
 * built with. No offset is applied - applying one would undo the construction.
 */
export function workbookWallClock(date: Date): WallClock {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  }
}

/** Parses a Haravan timestamp; null for a missing or unreadable one. */
export function parseHaravanInstant(raw: string | null | undefined): Date | null {
  if (raw == null) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function wallClocksEqual(a: WallClock, b: WallClock): boolean {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute
  )
}

/** `dd/MM/yyyy HH:mm`, or the date alone when the time is midnight. */
export function formatWallClock(clock: WallClock | null): string {
  if (clock == null) return '(không có)'
  const day = `${clock.day}`.padStart(2, '0')
  const month = `${clock.month}`.padStart(2, '0')
  const date = `${day}/${month}/${clock.year}`
  if (clock.hour === 0 && clock.minute === 0) return date
  const hour = `${clock.hour}`.padStart(2, '0')
  const minute = `${clock.minute}`.padStart(2, '0')
  return `${date} ${hour}:${minute}`
}

/**
 * The calendar day a Haravan instant falls on in the shop's zone, as a Date
 * built from calendar fields - the same form the workbook reader produces.
 *
 * Only for day-level work such as narrowing a date range. Minute-level checks
 * use `compareTimestamps`, which never rebuilds a Date at all.
 */
export function shopLocalDay(instant: Date | null, offsetMinutes: number): Date | null {
  if (instant == null) return null
  const clock = shopWallClockOf(instant, offsetMinutes)
  return new Date(clock.year, clock.month - 1, clock.day)
}

export type TimestampComparison = {
  excel: WallClock | null
  haravan: WallClock | null
  /** True when both sides describe the same minute, or when both are absent. */
  equal: boolean
}

/**
 * Compares one Excel date against one Haravan instant, to the minute.
 *
 * A missing value on one side only is a mismatch, deliberately: `ends_at = null`
 * against a file that names an end date is a promotion that never stops, which
 * is exactly the kind of thing this screen exists to catch.
 */
export function compareTimestamps(
  excelDate: Date | null,
  haravanInstant: Date | null,
  offsetMinutes: number,
): TimestampComparison {
  const excel = excelDate ? workbookWallClock(excelDate) : null
  const haravan = haravanInstant ? shopWallClockOf(haravanInstant, offsetMinutes) : null
  if (excel == null && haravan == null) return { excel, haravan, equal: true }
  if (excel == null || haravan == null) return { excel, haravan, equal: false }
  return { excel, haravan, equal: wallClocksEqual(excel, haravan) }
}
