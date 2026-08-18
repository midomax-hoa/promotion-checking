/**
 * C2 - the discount is zero, negative, or absent on a fixed-amount row.
 *
 * Critical: Haravan answers 422 for `value = 0` and for a negative value
 * (verified against the dev store on 2026-08-17), so the whole program fails to
 * be created - not just the offending row.
 *
 * A blank `Số tiền giảm` on a `Giảm giá theo số tiền` row counts here too: it
 * reaches Haravan as no value at all, with the same result. The sample file has
 * exactly this mix - program `2608GST0K` holds 275 zero rows and 4 blank ones,
 * and all 279 die together.
 */

import { formatVnd } from '../helpers/money'
import { rowRef } from '../helpers/row-ref'
import type { Rule, RuleFinding } from '../types'

const REJECTED_BY_HARAVAN =
  'Haravan sẽ từ chối (lỗi 422), toàn bộ chương trình này không được tạo.'

export const c2ZeroOrNegativeDiscount: Rule = {
  code: 'C2',
  groupCode: 'C',
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []

    for (const row of ctx.workbook.rows) {
      const { discountAmount, discountPercent, discountType } = row

      if (discountAmount == null) {
        // Only fatal when the row claims to be a fixed-amount discount; a
        // percentage row legitimately leaves this column empty.
        if (discountType !== 'fixed_amount') continue
        findings.push({
          ...rowRef(row),
          message:
            `Dòng ${row.rowNumber}: kiểu "Giảm giá theo số tiền" nhưng cột "Số tiền giảm" ` +
            `để trống. ${REJECTED_BY_HARAVAN}`,
          suggestion: 'Điền số tiền giảm lớn hơn 0, hoặc xoá dòng này khỏi chương trình.',
        })
        continue
      }

      if (discountAmount > 0) continue

      findings.push({
        ...rowRef(row),
        message:
          `Dòng ${row.rowNumber}: số tiền giảm ${formatVnd(discountAmount)}. ${REJECTED_BY_HARAVAN}`,
        suggestion:
          discountAmount === 0 && discountPercent != null
            ? 'Có thể mức giảm đang nằm ở cột "Phần trăm giảm". Kiểm tra lại cột "Kiểu ctkm".'
            : 'Điền số tiền giảm lớn hơn 0, hoặc xoá dòng này khỏi chương trình.',
      })
    }

    return findings
  },
}
