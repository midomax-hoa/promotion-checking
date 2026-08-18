/**
 * C6 - `Kiểu ctkm` is blank, unrecognised, or contradicts the filled columns.
 *
 * Critical because the type decides which column the import tool reads. Get it
 * wrong and either nothing is sent (422) or the wrong number is: a row typed as
 * "theo số tiền" whose value sits in the percentage column ships a 0đ discount.
 */

import { rowRef } from '../helpers/row-ref'
import type { Rule, RuleFinding } from '../types'

export const c6UnknownDiscountType: Rule = {
  code: 'C6',
  groupCode: 'C',
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []

    for (const row of ctx.workbook.rows) {
      const ref = rowRef(row)

      if (row.discountTypeRaw == null) {
        findings.push({
          ...ref,
          message: `Dòng ${row.rowNumber}: cột "Kiểu ctkm" để trống.`,
          suggestion: 'Điền "Giảm giá theo số tiền", "Giảm giá theo phần trăm" hoặc "Đồng giá".',
        })
        continue
      }

      if (row.discountType == null) {
        findings.push({
          ...ref,
          message: `Dòng ${row.rowNumber}: cột "Kiểu ctkm" ghi "${row.discountTypeRaw}", không nhận ra được kiểu khuyến mãi.`,
          suggestion: 'Sửa thành "Giảm giá theo số tiền", "Giảm giá theo phần trăm" hoặc "Đồng giá".',
        })
        continue
      }

      // Value in the column the declared type does not read: the classic
      // shifted-column paste.
      const misplaced =
        row.discountType === 'fixed_amount' && row.discountAmount == null && row.discountPercent != null
          ? { has: 'Phần trăm giảm', wants: 'Số tiền giảm' }
          : row.discountType === 'percentage' && row.discountPercent == null && row.discountAmount != null
            ? { has: 'Số tiền giảm', wants: 'Phần trăm giảm' }
            : null

      if (misplaced) {
        findings.push({
          ...ref,
          message:
            `Dòng ${row.rowNumber}: kiểu ghi "${row.discountTypeRaw}" nhưng cột "${misplaced.wants}" ` +
            `để trống, giá trị lại nằm ở cột "${misplaced.has}".`,
          suggestion: `Chuyển giá trị sang cột "${misplaced.wants}", hoặc sửa lại cột "Kiểu ctkm".`,
        })
      }
    }

    return findings
  },
}
