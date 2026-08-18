/**
 * Lines the file's programs up against the promotions Haravan holds.
 *
 * Matching is by name, because that is the only thing the two sides share - the
 * import tool keeps no reference back to the row it came from. Haravan allows
 * duplicate promotion names (verified while planning), so a name can match more
 * than one promotion. Those come back as `ambiguous` with **every** candidate
 * listed: picking one and reconciling against it would produce a confident
 * report about a promotion nobody chose.
 *
 * Promotions Haravan has and the file does not are only surfaced when their
 * window overlaps the file's. A shop accumulates promotions for years, and
 * listing all of them as "extra" would bury the handful that matter under the
 * history of every campaign ever run.
 */

import type { WorkbookReadResult } from '@/lib/excel/types'
import { windowsOverlap, type DateWindow } from '@/lib/rules/helpers/date-range'
import { readExpectation } from './program-expectation'
import { shopLocalDay } from './shop-time'
import type { MatchResult, ReconcilePromotion } from './types'

/** Trimmed, case-folded, inner runs of whitespace collapsed to one space. */
export function normalizeProgramName(raw: string | null | undefined): string {
  if (raw == null) return ''
  return raw.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Widest window the file describes, so promotions outside it can be ignored.
 * A row with no dates widens nothing; a program with no dates at all leaves the
 * window open on that side, and then nothing gets filtered out.
 */
export function workbookWindow(workbook: WorkbookReadResult): DateWindow {
  let start: Date | null = null
  let end: Date | null = null
  let sawOpenStart = false
  let sawOpenEnd = false

  for (const row of workbook.rows) {
    if (row.startAt == null) sawOpenStart = true
    else if (start == null || row.startAt < start) start = row.startAt

    if (row.endAt == null) sawOpenEnd = true
    else if (end == null || row.endAt > end) end = row.endAt
  }

  return { start: sawOpenStart ? null : start, end: sawOpenEnd ? null : end }
}

export type MatchOptions = {
  /** From AppSetting `shop.timezone_offset_minutes`; used to place a promotion on a day. */
  shopTimezoneOffsetMinutes: number
}

export function matchPrograms(
  workbook: WorkbookReadResult,
  promotions: readonly ReconcilePromotion[],
  options: MatchOptions,
): MatchResult[] {
  const byName = new Map<string, ReconcilePromotion[]>()
  for (const promotion of promotions) {
    const key = normalizeProgramName(promotion.name)
    const bucket = byName.get(key)
    if (bucket) bucket.push(promotion)
    else byName.set(key, [promotion])
  }

  const matches: MatchResult[] = []
  const claimed = new Set<string>()

  for (const program of workbook.programs) {
    const key = normalizeProgramName(program.name)
    claimed.add(key)
    const haravanMatches = byName.get(key) ?? []
    matches.push({
      programName: program.name,
      expectation: readExpectation(program),
      excelProgram: program,
      haravanMatches,
      status:
        haravanMatches.length === 0
          ? 'not-found'
          : haravanMatches.length === 1
            ? 'matched'
            : 'ambiguous',
    })
  }

  const fileWindow = workbookWindow(workbook)
  const offset = options.shopTimezoneOffsetMinutes

  for (const [key, bucket] of byName) {
    if (claimed.has(key)) continue
    for (const promotion of bucket) {
      const promotionWindow: DateWindow = {
        start: shopLocalDay(promotion.startAt, offset),
        end: shopLocalDay(promotion.endAt, offset),
      }
      if (!windowsOverlap(fileWindow, promotionWindow)) continue
      matches.push({
        programName: promotion.name,
        expectation: null,
        excelProgram: null,
        haravanMatches: [promotion],
        status: 'extra-on-haravan',
      })
    }
  }

  return matches
}

/** Names the file expects but Haravan does not hold. Feeds the two-pass agreement check. */
export function notFoundNames(matches: readonly MatchResult[]): Set<string> {
  const names = new Set<string>()
  for (const match of matches) {
    if (match.status === 'not-found') names.add(normalizeProgramName(match.programName))
  }
  return names
}
