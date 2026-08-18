/**
 * B2 - the product behind this SKU has never been published.
 *
 * The promotion is created and attaches fine, but customers cannot see the
 * product, so the discount does nothing. A warning rather than an error: the
 * usual case is a launch where the product goes live the same week.
 */

import { rowRef } from '../helpers/row-ref'
import type { Rule, RuleFinding } from '../types'

export const b2ProductNotPublished: Rule = {
  code: 'B2',
  groupCode: 'B',
  requires: ['catalog'],
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []

    for (const row of ctx.workbook.rows) {
      if (row.skuNormalized == null) continue
      const entries = ctx.catalog.bySku.get(row.skuNormalized)
      // Unknown SKU is B1's report, not this one's.
      if (entries == null || entries.length === 0) continue
      // Only report when no variant behind the SKU is on sale at all.
      if (entries.some((entry) => entry.publishedAt != null)) continue

      findings.push({
        ...rowRef(row),
        message:
          `Dòng ${row.rowNumber}: sản phẩm "${entries[0].productTitle}" (mã hiệu "${row.sku}") ` +
          `chưa đăng bán trên Haravan.`,
        suggestion:
          'Khuyến mãi vẫn được tạo nhưng khách không thấy sản phẩm. ' +
          'Đăng bán sản phẩm trước ngày chương trình bắt đầu.',
      })
    }

    return findings
  },
}
