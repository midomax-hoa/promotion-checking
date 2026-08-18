/**
 * D5 - the program has already ended.
 *
 * Haravan creates it without complaint and it never applies to anything, so the
 * import looks successful and the discount simply does not happen. Almost
 * always a file carried over from a previous month.
 */

import { daysBetween, startOfDay } from '../helpers/date-range'
import type { Rule, RuleFinding } from '../types'
import { describeWindowRows, formatDate, programRef, programWindows } from './program-ref'

export const d5EndDatePassed: Rule = {
  code: 'D5',
  groupCode: 'D',
  run(ctx): RuleFinding[] {
    const today = startOfDay(ctx.now)
    const findings: RuleFinding[] = []

    for (const program of ctx.workbook.programs) {
      const windows = programWindows(program)
      for (const window of windows) {
        if (window.end == null || startOfDay(window.end) >= today) continue

        const days = daysBetween(window.end, today)
        findings.push({
          ...programRef(program),
          message:
            `Chương trình "${program.name}": ngày kết thúc ${formatDate(window.end)} đã qua ` +
            `${days} ngày${describeWindowRows(window, windows.length)}. ` +
            `Haravan vẫn tạo nhưng khuyến mãi không bao giờ chạy.`,
          suggestion:
            'Sửa lại ngày kết thúc, hoặc bỏ chương trình này ra khỏi file nếu là dữ liệu tháng cũ.',
        })
      }
    }

    return findings
  },
}
