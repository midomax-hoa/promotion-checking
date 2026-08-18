/**
 * C7 - the price after discount is not a round number.
 *
 * Purely cosmetic and often intentional, hence a warning. It does catch the
 * common case of a percentage applied to an odd list price, where the shelf
 * price ends up at 158.700đ.
 */

import { formatVnd } from '../helpers/money'
import { rowRef } from '../helpers/row-ref'
import { numberParam, type Rule, type RuleFinding } from '../types'

const DEFAULT_ROUNDING_UNIT = 1000

export const c7PriceNotRounded: Rule = {
  code: 'C7',
  groupCode: 'C',
  run(ctx): RuleFinding[] {
    const unit = numberParam(ctx.params, 'roundingUnit', DEFAULT_ROUNDING_UNIT)
    // A unit of 0 or less would divide by zero; treat it as "rounding disabled".
    if (unit <= 0) return []

    const findings: RuleFinding[] = []

    for (const row of ctx.workbook.rows) {
      const price = row.priceAfter
      if (price == null) continue

      const remainder = Math.round(price) % unit
      if (remainder === 0) continue

      const down = Math.round(price) - remainder
      findings.push({
        ...rowRef(row),
        message:
          `Dòng ${row.rowNumber}: giá sau giảm ${formatVnd(price)} không tròn ${formatVnd(unit)}.`,
        suggestion:
          `Làm tròn về ${formatVnd(down)} hoặc ${formatVnd(down + unit)} nếu muốn giá đẹp. ` +
          `Đơn vị làm tròn sửa được ở cấu hình luật (tham số roundingUnit).`,
      })
    }

    return findings
  },
}
