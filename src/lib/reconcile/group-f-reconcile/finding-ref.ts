/**
 * Locators and labels shared by the six group F rules.
 *
 * A reconciliation finding is about a whole program rather than one cell, so it
 * carries the program name and the sheet the program came from - enough for the
 * result screen to group it and for the user to find the rows.
 */

import type { RuleFinding } from '@/lib/rules/types'
import { formatVnd } from '@/lib/rules/helpers/money'
import type { MatchResult, ReconcilePromotion } from '../types'
import { formatWallClock, shopWallClockOf } from '../shop-time'

export function programLocation(match: MatchResult): Pick<
  RuleFinding,
  'sheetName' | 'programName'
> {
  return {
    sheetName: match.excelProgram?.sheetNames.join(', '),
    programName: match.programName,
  }
}

/** Only the single match may be reconciled; `ambiguous` deliberately yields none. */
export function soleMatch(match: MatchResult): ReconcilePromotion | null {
  return match.status === 'matched' && match.haravanMatches.length === 1
    ? match.haravanMatches[0]
    : null
}

/** A discount in the unit its kind implies. Both sides already use Haravan's unit. */
export function formatDiscount(value: number | null, takeType: string | null): string {
  if (value == null) return '(không có)'
  if (takeType === 'percentage') return `${value}%`
  if (takeType === 'fixed_amount') return formatVnd(value)
  return `${value}`
}

export function formatInstant(instant: Date | null, offsetMinutes: number): string {
  return formatWallClock(instant ? shopWallClockOf(instant, offsetMinutes) : null)
}
