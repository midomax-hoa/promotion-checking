/**
 * D6 - the end date is earlier than the start date.
 *
 * Critical: Haravan answers 422 for `ends_at < starts_at` (verified on the dev
 * store), so the program is not created at all and every SKU in it goes without
 * a discount.
 */

import { daysBetween, startOfDay } from '../helpers/date-range'
import type { Rule, RuleFinding } from '../types'
import { describeWindowRows, formatDate, programRef, programWindows } from './program-ref'

export const d6EndBeforeStart: Rule = {
  code: 'D6',
  groupCode: 'D',
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []

    for (const program of ctx.workbook.programs) {
      const windows = programWindows(program)
      for (const window of windows) {
        if (window.start == null || window.end == null) continue
        if (startOfDay(window.end) >= startOfDay(window.start)) continue

        findings.push({
          ...programRef(program),
          message:
            `Chương trình "${program.name}": kết thúc ${formatDate(window.end)} trước khi bắt đầu ` +
            `${formatDate(window.start)}, sớm hơn ${Math.abs(daysBetween(window.start, window.end))} ngày` +
            `${describeWindowRows(window, windows.length)}. ` +
            `Haravan sẽ từ chối (lỗi 422), chương trình không được tạo.`,
          suggestion: 'Đổi chỗ hai cột ngày, hoặc sửa lại ngày kết thúc cho đúng.',
        })
      }
    }

    return findings
  },
}
