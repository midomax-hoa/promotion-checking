/**
 * B3 - `Giá niêm yết` in the file differs from the variant's real price.
 *
 * Haravan discounts the *real* price, not the one written in the file, so the
 * final price customers see will not be the file's `Giá sau giảm`. That is a
 * money problem, hence danger rather than warning.
 */

import { formatVnd, moneyEquals } from '../helpers/money'
import { rowRef } from '../helpers/row-ref'
import type { Rule, RuleFinding } from '../types'

export const b3ListPriceMismatch: Rule = {
  code: 'B3',
  groupCode: 'B',
  requires: ['catalog'],
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []

    for (const row of ctx.workbook.rows) {
      if (row.skuNormalized == null || row.listPrice == null) continue
      const entries = ctx.catalog.bySku.get(row.skuNormalized)
      if (entries == null || entries.length === 0) continue
      // With several variants on one SKU, a match on any of them is good enough;
      // B5 reports the ambiguity separately.
      if (entries.some((entry) => moneyEquals(entry.price, row.listPrice!, ctx.moneyToleranceVnd))) {
        continue
      }

      const real = entries[0].price
      const realAfter = row.discountAmount == null ? null : real - row.discountAmount

      findings.push({
        ...rowRef(row),
        message:
          `Dòng ${row.rowNumber}: file ghi giá niêm yết ${formatVnd(row.listPrice)}, ` +
          `Haravan đang để ${formatVnd(real)} (lệch ${formatVnd(Math.abs(real - row.listPrice))}).`,
        suggestion:
          realAfter == null
            ? 'Haravan giảm trên giá thật của nó, không giảm trên giá trong file. Đối chiếu lại giá.'
            : `Haravan giảm trên giá thật, nên khách sẽ mua với giá ${formatVnd(realAfter)} ` +
              `chứ không phải ${formatVnd(row.priceAfter ?? realAfter)}.`,
      })
    }

    return findings
  },
}
