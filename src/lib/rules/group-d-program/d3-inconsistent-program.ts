/**
 * D3 - rows sharing a program name disagree about dates, discount or type.
 *
 * Haravan creates exactly one promotion per name, with one window and one
 * discount. When the file gives two, the import tool picks one - usually the
 * first row it reads - and the rest of the rows quietly inherit a value nobody
 * chose.
 */

import { formatPercent, formatVnd } from '../helpers/money'
import type { Rule, RuleFinding } from '../types'
import { formatDate, programRef } from './program-ref'

const BLANK = '(bỏ trống)'

function listValues<T>(values: readonly T[], format: (value: T & {}) => string): string {
  return values.map((value) => (value == null ? BLANK : format(value))).join(', ')
}

export const d3InconsistentProgram: Rule = {
  code: 'D3',
  groupCode: 'D',
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []

    for (const program of ctx.workbook.programs) {
      const conflicts: string[] = []

      if (program.distinctStarts.length > 1) {
        conflicts.push(`${program.distinctStarts.length} ngày bắt đầu khác nhau (${listValues(program.distinctStarts, formatDate)})`)
      }
      if (program.distinctEnds.length > 1) {
        conflicts.push(`${program.distinctEnds.length} ngày kết thúc khác nhau (${listValues(program.distinctEnds, formatDate)})`)
      }
      if (program.distinctAmounts.length > 1) {
        conflicts.push(`${program.distinctAmounts.length} mức giảm khác nhau (${listValues(program.distinctAmounts, formatVnd)})`)
      }
      if (program.distinctPercents.length > 1) {
        conflicts.push(`${program.distinctPercents.length} phần trăm giảm khác nhau (${listValues(program.distinctPercents, formatPercent)})`)
      }
      if (program.distinctDiscountTypes.length > 1) {
        conflicts.push(`${program.distinctDiscountTypes.length} kiểu khuyến mãi khác nhau`)
      }

      if (conflicts.length === 0) continue

      findings.push({
        ...programRef(program),
        message:
          `Chương trình "${program.name}" có ${program.rows.length} dòng nhưng ghi ${conflicts.join('; ')}.`,
        suggestion:
          'Haravan chỉ tạo được một chương trình với một mức giảm và một khoảng thời gian. ' +
          'Thống nhất lại, hoặc tách thành các chương trình có tên khác nhau.',
      })
    }

    return findings
  },
}
