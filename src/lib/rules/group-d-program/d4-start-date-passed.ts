/**
 * D4 - the program starts in the past.
 *
 * Haravan accepts it and the promotion goes live immediately, which is often
 * exactly what was wanted for a file prepared a few days late. Worth a warning
 * anyway: the discount is retroactive from the operator's point of view but not
 * from the customer's, so orders placed since the start date got full price.
 */

import { daysBetween, startOfDay } from '../helpers/date-range'
import type { Rule, RuleFinding } from '../types'
import { describeWindowRows, formatDate, programRef, programWindows } from './program-ref'

export const d4StartDatePassed: Rule = {
  code: 'D4',
  groupCode: 'D',
  run(ctx): RuleFinding[] {
    const today = startOfDay(ctx.now)
    const findings: RuleFinding[] = []

    for (const program of ctx.workbook.programs) {
      const windows = programWindows(program)
      for (const window of windows) {
        if (window.start == null || startOfDay(window.start) >= today) continue

        const days = daysBetween(window.start, today)
        findings.push({
          ...programRef(program),
          message:
            `Chương trình "${program.name}": ngày bắt đầu ${formatDate(window.start)} đã trôi qua ` +
            `${days} ngày${describeWindowRows(window, windows.length)}.`,
          suggestion:
            'Import xong là khuyến mãi chạy ngay. Nếu muốn bắt đầu từ hôm nay thì sửa lại ngày bắt đầu.',
        })
      }
    }

    return findings
  },
}
