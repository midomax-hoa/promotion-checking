/**
 * B5 - one SKU is attached to several variants on Haravan.
 *
 * Haravan permits duplicate SKUs, so a lookup by SKU is ambiguous: the import
 * tool binds the promotion to whichever variant comes back first, which may not
 * be the one the row means. The listed variants let the user tell them apart.
 */

import { formatVnd } from '../helpers/money'
import { rowRef } from '../helpers/row-ref'
import type { Rule, RuleFinding } from '../types'

/** Enough to identify the culprits without turning the message into a table. */
const MAX_LISTED = 3

export const b5SkuMatchesManyVariants: Rule = {
  code: 'B5',
  groupCode: 'B',
  requires: ['catalog'],
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []

    for (const row of ctx.workbook.rows) {
      if (row.skuNormalized == null) continue
      const entries = ctx.catalog.bySku.get(row.skuNormalized)
      if (entries == null || entries.length < 2) continue

      const listed = entries
        .slice(0, MAX_LISTED)
        .map((entry) => {
          const variant = entry.variantTitle ? ` - ${entry.variantTitle}` : ''
          return `"${entry.productTitle}${variant}" (${formatVnd(entry.price)})`
        })
        .join(', ')
      const more = entries.length > MAX_LISTED ? `, và ${entries.length - MAX_LISTED} biến thể nữa` : ''

      findings.push({
        ...rowRef(row),
        message:
          `Dòng ${row.rowNumber}: mã hiệu "${row.sku}" khớp ${entries.length} biến thể trên Haravan: ` +
          `${listed}${more}.`,
        suggestion:
          'Không xác định được khuyến mãi sẽ gắn vào biến thể nào. ' +
          'Sửa mã hiệu trùng lặp trên Haravan để mỗi biến thể một mã riêng.',
      })
    }

    return findings
  },
}
