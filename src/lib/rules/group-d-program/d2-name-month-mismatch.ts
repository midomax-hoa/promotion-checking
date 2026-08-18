/**
 * D2 - the month in the program name is not the month the program runs.
 *
 * `2608GST130K` reads as August 2026; a start date in July means either the
 * name was copied from last month's file or the dates were. Disabled by
 * default, same reason as D1.
 */

import type { Rule, RuleFinding } from '../types'
import { parseProgramName } from './program-name'
import { formatDate, programRef, programWindows } from './program-ref'

export const d2NameMonthMismatch: Rule = {
  code: 'D2',
  groupCode: 'D',
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []

    for (const program of ctx.workbook.programs) {
      const { year, month } = parseProgramName(program.name)
      if (year == null || month == null) continue

      for (const window of programWindows(program)) {
        const start = window.start
        if (start == null) continue
        if (start.getFullYear() === year && start.getMonth() + 1 === month) continue

        findings.push({
          ...programRef(program),
          message:
            `Chương trình "${program.name}": tên ghi tháng ${month}/${year} nhưng ngày bắt đầu là ` +
            `${formatDate(start)}.`,
          suggestion:
            'Kiểm tra lại: hoặc tên chương trình chép từ tháng trước, hoặc cột ngày chép nhầm.',
        })
      }
    }

    return findings
  },
}
