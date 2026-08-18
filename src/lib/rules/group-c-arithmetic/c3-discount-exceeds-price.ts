/**
 * C3 - the discount is at least the list price, i.e. the item ends up free or
 * negative.
 *
 * Haravan accepts this (verified on the dev store), which is what makes it
 * dangerous: the program is created, sells at 0đ, and nobody notices until the
 * orders arrive.
 */

import { formatVnd } from '../helpers/money'
import { rowRef } from '../helpers/row-ref'
import type { Rule, RuleFinding } from '../types'

export const c3DiscountExceedsPrice: Rule = {
  code: 'C3',
  groupCode: 'C',
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []

    for (const row of ctx.workbook.rows) {
      const { listPrice, discountAmount } = row
      // Zero and negative discounts belong to C2; reporting them twice helps nobody.
      if (listPrice == null || discountAmount == null || discountAmount <= 0) continue
      if (discountAmount < listPrice) continue

      const remaining = listPrice - discountAmount
      findings.push({
        ...rowRef(row),
        message:
          `Dòng ${row.rowNumber}: giảm ${formatVnd(discountAmount)} trong khi giá niêm yết chỉ ` +
          `${formatVnd(listPrice)}. Khách sẽ mua với giá ${formatVnd(Math.max(0, remaining))}.`,
        suggestion:
          'Haravan vẫn tạo chương trình này. Kiểm tra lại số tiền giảm trước khi import, ' +
          'nếu không hàng sẽ bán với giá 0đ.',
      })
    }

    return findings
  },
}
