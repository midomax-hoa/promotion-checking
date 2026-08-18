/**
 * D7 - the program runs for an unusual length of time.
 *
 * Two shapes: far longer than a normal campaign (`maxDurationDays`), or shorter
 * than `minDurationDays` - typically the same date in both cells, which reads
 * as a promotion lasting no time at all. Both thresholds come from
 * `RuleConfig.params`.
 */

import { daysBetween } from '../helpers/date-range'
import { numberParam, type Rule, type RuleFinding } from '../types'
import { describeWindowRows, formatDate, programRef, programWindows } from './program-ref'

const DEFAULT_MAX_DURATION_DAYS = 90
const DEFAULT_MIN_DURATION_DAYS = 1

export const d7UnusualDuration: Rule = {
  code: 'D7',
  groupCode: 'D',
  run(ctx): RuleFinding[] {
    const maxDays = numberParam(ctx.params, 'maxDurationDays', DEFAULT_MAX_DURATION_DAYS)
    const minDays = numberParam(ctx.params, 'minDurationDays', DEFAULT_MIN_DURATION_DAYS)
    const findings: RuleFinding[] = []

    for (const program of ctx.workbook.programs) {
      const windows = programWindows(program)
      for (const window of windows) {
        if (window.start == null || window.end == null) continue
        const days = daysBetween(window.start, window.end)
        // A backwards window is D6's report, not a duration problem.
        if (days < 0) continue

        const tail = describeWindowRows(window, windows.length)
        const period = `${formatDate(window.start)} - ${formatDate(window.end)}`

        if (days > maxDays) {
          findings.push({
            ...programRef(program),
            message:
              `Chương trình "${program.name}" kéo dài ${days} ngày (${period}), vượt ngưỡng ` +
              `${maxDays} ngày đang cấu hình${tail}.`,
            suggestion:
              'Kiểm tra lại ngày kết thúc. Ngưỡng này sửa được ở cấu hình luật (tham số maxDurationDays).',
          })
        } else if (days < minDays) {
          findings.push({
            ...programRef(program),
            message:
              days === 0
                ? `Chương trình "${program.name}" bắt đầu và kết thúc cùng ngày ${formatDate(window.start)}${tail}.`
                : `Chương trình "${program.name}" chỉ kéo dài ${days} ngày (${period}), ngắn hơn ngưỡng ${minDays} ngày${tail}.`,
            suggestion:
              'Nếu đúng là khuyến mãi trong ngày thì bỏ qua. Nếu không, sửa lại ngày kết thúc.',
          })
        }
      }
    }

    return findings
  },
}
