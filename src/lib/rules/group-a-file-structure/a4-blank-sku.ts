/**
 * A4 - the `Mã hiệu` cell is empty or only whitespace.
 *
 * A row without a SKU cannot be attached to any variant, so the import tool
 * drops it without a word. That is the same silent-loss problem rule B1 covers,
 * caught one step earlier.
 */

import type { Rule, RuleFinding } from '../types'

export const a4BlankSku: Rule = {
  code: 'A4',
  groupCode: 'A',
  run(ctx): RuleFinding[] {
    return ctx.workbook.rows
      .filter((row) => row.skuNormalized == null)
      .map((row) => ({
        sheetName: row.sheetName,
        rowNumber: row.rowNumber,
        programName: row.programName ?? undefined,
        message:
          `Dòng ${row.rowNumber}: cột "Mã hiệu" để trống. ` +
          `Dòng này sẽ bị bỏ qua khi import, sản phẩm không được khuyến mãi.`,
        suggestion: 'Điền mã hiệu (SKU) của biến thể, hoặc xoá hẳn dòng này khỏi file.',
      }))
  },
}
