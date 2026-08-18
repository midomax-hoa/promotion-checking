/**
 * A1 - a sheet is missing one of the columns without which it says nothing.
 *
 * Critical because the reader skips such a sheet entirely: every row in it goes
 * unchecked and, worse, unimported. Reporting it is the only way the user finds
 * out that half their file was never read.
 */

import { COLUMN_LABELS, type ColumnField } from '@/lib/excel/column-mapper'
import type { Rule, RuleFinding } from '../types'

export const a1MissingRequiredColumns: Rule = {
  code: 'A1',
  groupCode: 'A',
  run(ctx): RuleFinding[] {
    return ctx.workbook.missingRequiredColumns.map(({ sheetName, missing }) => {
      const labels = missing.map((field) => COLUMN_LABELS[field as ColumnField] ?? field)
      return {
        sheetName,
        message:
          `Sheet "${sheetName}" thiếu cột bắt buộc: ${labels.join(', ')}. ` +
          `Toàn bộ dòng trong sheet này đã bị bỏ qua, không được kiểm tra.`,
        suggestion:
          `Thêm cột ${labels.join(', ')} vào dòng tiêu đề của sheet "${sheetName}" rồi kiểm tra lại. ` +
          `Nếu đây là sheet ghi chú, không phải sheet dữ liệu, thì bỏ qua cảnh báo này.`,
      }
    })
  },
}
