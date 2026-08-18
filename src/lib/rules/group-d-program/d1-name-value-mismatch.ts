/**
 * D1 - the value encoded in the program name disagrees with the rows.
 *
 * `2608GST130K` promises 130.000đ off; if its rows say 140.000đ, one of the two
 * is a typo and only the person who wrote the file knows which. Disabled by
 * default because the naming convention is a habit, not a rule, and a team that
 * names programs differently would drown in warnings.
 */

import { formatPercent, formatVnd, moneyEquals } from '../helpers/money'
import type { Rule, RuleFinding } from '../types'
import { parseProgramName } from './program-name'
import { programRef } from './program-ref'

export const d1NameValueMismatch: Rule = {
  code: 'D1',
  groupCode: 'D',
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []

    for (const program of ctx.workbook.programs) {
      const parts = parseProgramName(program.name)

      if (parts.amount != null) {
        const amounts = program.distinctAmounts.filter((value) => value != null)
        const mismatched = amounts.filter(
          (value) => !moneyEquals(value, parts.amount!, ctx.moneyToleranceVnd),
        )
        if (amounts.length > 0 && mismatched.length === amounts.length) {
          findings.push({
            ...programRef(program),
            message:
              `Chương trình "${program.name}": tên ghi ${formatVnd(parts.amount)} nhưng các dòng ` +
              `ghi ${mismatched.map(formatVnd).join(', ')}.`,
            suggestion: 'Sửa tên chương trình hoặc sửa số tiền giảm cho khớp nhau.',
          })
        }
      }

      if (parts.percent != null) {
        const percents = program.distinctPercents.filter((value) => value != null)
        const mismatched = percents.filter(
          (value) => Math.abs(value - parts.percent!) > 0.0001,
        )
        if (percents.length > 0 && mismatched.length === percents.length) {
          findings.push({
            ...programRef(program),
            message:
              `Chương trình "${program.name}": tên ghi ${formatPercent(parts.percent)} nhưng các dòng ` +
              `ghi ${mismatched.map(formatPercent).join(', ')}.`,
            suggestion: 'Sửa tên chương trình hoặc sửa phần trăm giảm cho khớp nhau.',
          })
        }
      }
    }

    return findings
  },
}
