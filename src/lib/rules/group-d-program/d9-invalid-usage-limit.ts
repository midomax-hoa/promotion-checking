/**
 * D9 - `Số dư` is negative, or written as 0.
 *
 * The column caps how many times a promotion may be used. Blank means no cap,
 * which is the normal case (every row of the sample file leaves it blank). An
 * explicit 0 means the promotion may never be used - almost certainly a
 * placeholder someone typed instead of leaving the cell empty.
 */

import { rowRef } from '../helpers/row-ref'
import type { Rule, RuleFinding } from '../types'

export const d9InvalidUsageLimit: Rule = {
  code: 'D9',
  groupCode: 'D',
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []

    for (const row of ctx.workbook.rows) {
      const limit = row.usageLimit
      // Blank is the normal "no limit"; only a written-down value is judged.
      if (limit == null || limit > 0) continue

      findings.push({
        ...rowRef(row),
        message:
          limit === 0
            ? `Dòng ${row.rowNumber}: cột "Số dư" ghi 0, tức chương trình không được dùng lần nào.`
            : `Dòng ${row.rowNumber}: cột "Số dư" ghi ${limit}, là số âm.`,
        suggestion: 'Để trống ô này nếu không muốn giới hạn số lần dùng, hoặc điền một số lớn hơn 0.',
      })
    }

    return findings
  },
}
