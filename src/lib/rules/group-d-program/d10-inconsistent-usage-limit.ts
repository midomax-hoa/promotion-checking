/**
 * D10 - rows of one program give different `Số dư` values.
 *
 * The limit belongs to the promotion, not to a row, so Haravan takes exactly
 * one of them. Kept separate from D3 because the fix is different: D3 is about
 * dates and discounts, this one is about a cell people fill in inconsistently.
 */

import type { Rule, RuleFinding } from '../types'
import { programRef } from './program-ref'

const BLANK = '(bỏ trống)'

export const d10InconsistentUsageLimit: Rule = {
  code: 'D10',
  groupCode: 'D',
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []

    for (const program of ctx.workbook.programs) {
      if (program.distinctUsageLimits.length < 2) continue

      const listed = program.distinctUsageLimits
        .map((value) => (value == null ? BLANK : `${value}`))
        .join(', ')

      findings.push({
        ...programRef(program),
        message:
          `Chương trình "${program.name}": các dòng ghi ${program.distinctUsageLimits.length} giá trị ` +
          `"Số dư" khác nhau (${listed}).`,
        suggestion:
          'Haravan chỉ nhận một giới hạn cho cả chương trình. Thống nhất lại một giá trị, ' +
          'hoặc để trống hết nếu không giới hạn.',
      })
    }

    return findings
  },
}
