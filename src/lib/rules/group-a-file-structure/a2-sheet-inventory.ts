/**
 * A2 - lists every sheet with the number of data rows read from it.
 *
 * Not an error: it exists so a sheet that was silently ignored, or one that
 * yielded far fewer rows than expected, is visible at a glance. The sample file
 * hides a two-row "Giảm phần trăm" sheet behind a 3.929-row one, and that is
 * exactly the kind of thing a manual check misses.
 */

import type { Rule, RuleFinding } from '../types'

export const a2SheetInventory: Rule = {
  code: 'A2',
  groupCode: 'A',
  run(ctx): RuleFinding[] {
    const skipped = new Set(ctx.workbook.missingRequiredColumns.map((s) => s.sheetName))

    return ctx.workbook.sheets.map((sheet): RuleFinding => {
      const rows = sheet.rowCount.toLocaleString('vi-VN')
      if (skipped.has(sheet.name)) {
        return {
          sheetName: sheet.name,
          message: `Sheet "${sheet.name}": có ${rows} dòng nhưng không được đọc vì thiếu cột bắt buộc.`,
        }
      }
      return {
        sheetName: sheet.name,
        message: `Sheet "${sheet.name}": đã đọc ${rows} dòng dữ liệu.`,
      }
    })
  },
}
