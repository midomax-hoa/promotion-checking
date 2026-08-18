/**
 * A3 - a start or end date cell that could not be turned into a date.
 *
 * Two shapes, reported differently because the fix differs: the cell is empty,
 * or the cell holds something that is not a date. Either way Haravan gets no
 * window, so the promotion is created wrong or not at all.
 */

import { COLUMN_LABELS } from '@/lib/excel/column-mapper'
import type { Rule, RuleFinding } from '../types'

const DATE_FIELDS = ['startAt', 'endAt'] as const

export const a3UnreadableDates: Rule = {
  code: 'A3',
  groupCode: 'A',
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []

    for (const row of ctx.workbook.rows) {
      for (const field of DATE_FIELDS) {
        const issue = row.issues[field]
        if (issue == null) continue

        const label = COLUMN_LABELS[field]
        const base = {
          sheetName: row.sheetName,
          rowNumber: row.rowNumber,
          programName: row.programName ?? undefined,
          sku: row.sku ?? undefined,
        }

        findings.push(
          issue === 'missing'
            ? {
                ...base,
                message: `Dòng ${row.rowNumber}: cột "${label}" để trống.`,
                suggestion: `Điền ngày vào cột "${label}" theo dạng dd/mm/yyyy.`,
              }
            : {
                ...base,
                message: `Dòng ${row.rowNumber}: cột "${label}" không đọc được thành ngày.`,
                suggestion:
                  `Sửa ô này về dạng ngày dd/mm/yyyy, hoặc định dạng ô thành kiểu Date trong Excel. ` +
                  `Ô đang là chữ thì Excel không hiểu là ngày.`,
              },
        )
      }
    }

    return findings
  },
}
