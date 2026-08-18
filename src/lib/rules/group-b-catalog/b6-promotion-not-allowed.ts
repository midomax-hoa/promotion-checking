/**
 * B6 - the product carries Haravan's `not_allow_promotion` flag.
 *
 * Kept at `danger` rather than `critical` for now. The field is read reliably
 * from the catalog (phase 02 stores it), but the dev store has no product with
 * the flag set, so it is still unverified whether Haravan refuses the promotion
 * outright (422) or creates it and silently declines to apply it. Raising this
 * to critical needs one product on the dev store flipped, a promotion attempt,
 * and the product restored - a write against Haravan, which this project does
 * not perform without an explicit go-ahead.
 */

import { rowRef } from '../helpers/row-ref'
import type { Rule, RuleFinding } from '../types'

export const b6PromotionNotAllowed: Rule = {
  code: 'B6',
  groupCode: 'B',
  requires: ['catalog'],
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []

    for (const row of ctx.workbook.rows) {
      if (row.skuNormalized == null) continue
      const entries = ctx.catalog.bySku.get(row.skuNormalized)
      if (entries == null || entries.length === 0) continue

      const blocked = entries.find((entry) => entry.notAllowPromotion)
      if (blocked == null) continue

      findings.push({
        ...rowRef(row),
        message:
          `Dòng ${row.rowNumber}: sản phẩm "${blocked.productTitle}" (mã hiệu "${row.sku}") ` +
          `đang bật cờ cấm khuyến mãi trên Haravan.`,
        suggestion:
          'Tắt cờ cấm khuyến mãi cho sản phẩm này trên Haravan, hoặc bỏ dòng này ra khỏi file. ' +
          'Để nguyên thì khuyến mãi có thể không được áp dụng.',
      })
    }

    return findings
  },
}
