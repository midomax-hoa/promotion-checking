/**
 * C1 - `Giá niêm yết` minus `Số tiền giảm` does not equal `Giá sau giảm`.
 *
 * Haravan is told the discount amount, not the final price, so a mismatch means
 * the file's own final price is a fiction: the price customers actually see
 * will be the one this rule computes.
 */

import { formatVnd, moneyEquals } from '../helpers/money'
import { rowRef } from '../helpers/row-ref'
import type { Rule, RuleFinding } from '../types'

export const c1PriceArithmetic: Rule = {
  code: 'C1',
  groupCode: 'C',
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []

    for (const row of ctx.workbook.rows) {
      const { listPrice, discountAmount, priceAfter } = row
      // A missing cell is A3/C2/C6 territory; C1 only judges complete arithmetic.
      if (listPrice == null || discountAmount == null || priceAfter == null) continue

      const expected = listPrice - discountAmount
      if (moneyEquals(expected, priceAfter, ctx.moneyToleranceVnd)) continue

      findings.push({
        ...rowRef(row),
        message:
          `Dòng ${row.rowNumber}: ${formatVnd(listPrice)} − ${formatVnd(discountAmount)} = ` +
          `${formatVnd(expected)}, nhưng cột "Giá sau giảm" ghi ${formatVnd(priceAfter)} ` +
          `(lệch ${formatVnd(Math.abs(expected - priceAfter))}).`,
        suggestion:
          `Haravan chỉ nhận số tiền giảm, không nhận giá sau giảm. Giá khách thấy sẽ là ` +
          `${formatVnd(expected)}. Sửa lại một trong hai cột cho khớp.`,
      })
    }

    return findings
  },
}
