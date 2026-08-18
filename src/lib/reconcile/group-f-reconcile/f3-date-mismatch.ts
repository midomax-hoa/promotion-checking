/**
 * F3 - the window on Haravan is not the window in the file.
 *
 * This is the rule the timezone work exists for. Haravan returns UTC instants
 * and the workbook holds calendar dates, so `2019-12-31T17:00:00Z` and
 * `01/01/2020` are the same moment for a shop at UTC+7 and would look like a
 * one-day error to a naive comparison. Every check goes through
 * `compareTimestamps`, which reduces both sides to a wall clock first.
 *
 * Silence when the file says nothing: a program with no end date in the file
 * gives no grounds to call Haravan's end date wrong. The reverse - the file
 * names an end date and Haravan has none - is reported, because that is a
 * promotion that never stops.
 */

import type { RuleFinding } from '@/lib/rules/types'
import { compareTimestamps, formatWallClock } from '../shop-time'
import type { MatchResult, ReconcilePromotion, ReconcileRule } from '../types'
import { programLocation, soleMatch } from './finding-ref'

type FieldCheck = {
  label: string
  excel: Date | null
  haravan: Date | null
}

function describe(
  match: MatchResult,
  promotion: ReconcilePromotion,
  field: FieldCheck,
  offsetMinutes: number,
): RuleFinding | null {
  // Nothing stated in the file means nothing to hold Haravan to.
  if (field.excel == null) return null

  const comparison = compareTimestamps(field.excel, field.haravan, offsetMinutes)
  if (comparison.equal) return null

  const haravanText =
    field.haravan == null
      ? 'Haravan để trống (chương trình chạy vô thời hạn)'
      : `Haravan để ${formatWallClock(comparison.haravan)}`

  return {
    ...programLocation(match),
    message:
      `Chương trình "${match.programName}": ${field.label} trong file là ` +
      `${formatWallClock(comparison.excel)}, ${haravanText}.`,
    suggestion:
      field.haravan == null
        ? 'Đặt lại ngày kết thúc trên Haravan, không thì chương trình chạy mãi không dừng.'
        : `Sửa ${field.label} trên Haravan cho khớp file, hoặc xoá rồi import lại.`,
  }
}

export const f3DateMismatch: ReconcileRule = {
  code: 'F3',
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []

    for (const match of ctx.matches) {
      const promotion = soleMatch(match)
      const expectation = match.expectation
      if (promotion == null || expectation == null || expectation.inconsistent) continue

      const checks: FieldCheck[] = [
        { label: 'ngày bắt đầu', excel: expectation.startAt, haravan: promotion.startAt },
        { label: 'ngày kết thúc', excel: expectation.endAt, haravan: promotion.endAt },
      ]
      for (const check of checks) {
        const finding = describe(match, promotion, check, ctx.shopTimezoneOffsetMinutes)
        if (finding) findings.push(finding)
      }
    }

    return findings
  },
}
