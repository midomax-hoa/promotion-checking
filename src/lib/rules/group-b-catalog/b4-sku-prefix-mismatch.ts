/**
 * B4 - `Mã hiệu` does not start with the row's `Mã`.
 *
 * House convention: a variant SKU is the product code plus a suffix
 * (`KMAP231728F` -> `KMAP231728F.L`). A row that breaks it usually means one of
 * the two cells was pasted from the wrong line, so the discount would land on
 * another product entirely.
 *
 * Sits in group B by catalogue, but reads nothing from the catalogue - so it
 * keeps working when the product cache has never been synced.
 */

import { rowRef } from '../helpers/row-ref'
import type { Rule, RuleFinding } from '../types'

export const b4SkuPrefixMismatch: Rule = {
  code: 'B4',
  groupCode: 'B',
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []

    for (const row of ctx.workbook.rows) {
      const code = row.productCode?.trim()
      const sku = row.sku?.trim()
      if (!code || !sku) continue
      if (sku.toLowerCase().startsWith(code.toLowerCase())) continue

      findings.push({
        ...rowRef(row),
        message:
          `Dòng ${row.rowNumber}: mã hiệu "${sku}" không bắt đầu bằng mã sản phẩm "${code}".`,
        suggestion:
          'Thường là do một trong hai ô bị dán lệch dòng. Kiểm tra lại cột "Mã" và "Mã hiệu" ' +
          'trước khi import, nếu không khuyến mãi sẽ rơi vào sản phẩm khác.',
      })
    }

    return findings
  },
}
