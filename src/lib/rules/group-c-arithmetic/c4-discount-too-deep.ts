/**
 * C4 - the discount goes deeper than the configured ceiling.
 *
 * A warning, not an error: a clearance program really can take 80% off. The
 * threshold lives in `RuleConfig.params.maxDiscountPercent` so the operator can
 * move it without a deploy.
 */

import { discountFraction, formatPercent, formatVnd } from '../helpers/money'
import { rowRef } from '../helpers/row-ref'
import { numberParam, type Rule, type RuleFinding } from '../types'

const DEFAULT_MAX_DISCOUNT_PERCENT = 70

export const c4DiscountTooDeep: Rule = {
  code: 'C4',
  groupCode: 'C',
  run(ctx): RuleFinding[] {
    const maxPercent = numberParam(ctx.params, 'maxDiscountPercent', DEFAULT_MAX_DISCOUNT_PERCENT)
    const maxFraction = maxPercent / 100
    const findings: RuleFinding[] = []

    for (const row of ctx.workbook.rows) {
      // Percentage rows state the depth directly; amount rows need the list price.
      const fraction = row.discountPercent ?? discountFraction(row.listPrice, row.discountAmount)
      if (fraction == null || fraction <= maxFraction) continue

      const detail =
        row.discountPercent != null
          ? `giảm ${formatPercent(fraction)}`
          : `giảm ${formatVnd(row.discountAmount ?? 0)} trên giá niêm yết ` +
            `${formatVnd(row.listPrice ?? 0)}, tức ${formatPercent(fraction)}`

      findings.push({
        ...rowRef(row),
        message: `Dòng ${row.rowNumber}: ${detail}, vượt ngưỡng ${maxPercent}% đang cấu hình.`,
        suggestion:
          `Nếu đây là chương trình xả hàng thì bỏ qua. Nếu không, kiểm tra lại mức giảm. ` +
          `Ngưỡng này sửa được ở màn hình cấu hình luật (tham số maxDiscountPercent).`,
      })
    }

    return findings
  },
}
