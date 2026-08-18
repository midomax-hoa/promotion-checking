/**
 * Parses promotion start/end cells across every shape a real file throws at us.
 *
 * The whole point is the timezone handling. Excel stores a date as a day number
 * with no zone, and `exceljs` surfaces it as UTC midnight - `46235` arrives as
 * `2026-08-01T00:00:00.000Z`. Read that with `getDate()` west of Greenwich and
 * the promotion starts on 31 July. So every path here rebuilds a local Date
 * from the *UTC* calendar parts: the day the author typed is the day we keep,
 * whatever the server's timezone.
 *
 * There is deliberately no fallback. An unreadable cell returns `ok: false` and
 * becomes a visible issue, because a promotion with a quietly invented date
 * ships and a flagged one gets fixed.
 */

import { unwrapCell } from './cell-value'

export type DateParseResult =
  | { ok: true; value: Date; source: 'serial' | 'date' | 'iso-string' | 'dmy-string' }
  | { ok: false; raw: unknown }

/** Days between the Excel epoch (1899-12-30) and the Unix epoch. */
const EXCEL_EPOCH_OFFSET_DAYS = 25569
const MS_PER_DAY = 86_400_000

/** 1 = 1900-01-01, 2958465 = 9999-12-31. Anything outside is not a date someone typed. */
const MIN_SERIAL = 1
const MAX_SERIAL = 2_958_465

const ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/
const DMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/

/**
 * Builds a local Date and verifies it round-trips, so 31/02/2026 is rejected
 * instead of rolling over into March the way the Date constructor would.
 */
function localDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  if (hour > 23 || minute > 59 || second > 59) return null

  const date = new Date(year, month - 1, day, hour, minute, second, 0)
  const roundTrips =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  return roundTrips ? date : null
}

/** Re-reads a UTC instant as the local calendar day its author meant. */
function fromUtcParts(date: Date): Date | null {
  return localDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  )
}

function fromSerial(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial < MIN_SERIAL || serial > MAX_SERIAL) return null
  // Round to the second: floating-point day fractions land on 07:59:59.9999.
  const ms = Math.round((serial - EXCEL_EPOCH_OFFSET_DAYS) * MS_PER_DAY / 1000) * 1000
  return fromUtcParts(new Date(ms))
}

function fromString(text: string): DateParseResult | null {
  const iso = ISO.exec(text)
  if (iso) {
    const value = localDate(+iso[1], +iso[2], +iso[3], +(iso[4] ?? 0), +(iso[5] ?? 0), +(iso[6] ?? 0))
    return value ? { ok: true, value, source: 'iso-string' } : null
  }

  const dmy = DMY.exec(text)
  if (dmy) {
    // Day first, month second - the order used in Vietnamese spreadsheets.
    const value = localDate(+dmy[3], +dmy[2], +dmy[1], +(dmy[4] ?? 0), +(dmy[5] ?? 0), +(dmy[6] ?? 0))
    return value ? { ok: true, value, source: 'dmy-string' } : null
  }

  return null
}

export function parseExcelDate(raw: unknown): DateParseResult {
  const value = unwrapCell(raw)
  const failed: DateParseResult = { ok: false, raw }
  if (value == null || typeof value === 'boolean') return failed

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return failed
    const rebuilt = fromUtcParts(value)
    return rebuilt ? { ok: true, value: rebuilt, source: 'date' } : failed
  }

  if (typeof value === 'number') {
    const rebuilt = fromSerial(value)
    return rebuilt ? { ok: true, value: rebuilt, source: 'serial' } : failed
  }

  const text = value.trim()
  if (text.length === 0) return failed
  return fromString(text) ?? failed
}
