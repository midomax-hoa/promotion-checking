/**
 * A5 - an empty row sitting between two data rows.
 *
 * Usually harmless, but it is the signature of rows pasted in from a second
 * file, and some import tools stop reading at the first blank row - in which
 * case everything below the gap never reaches Haravan.
 */

import type { Rule, RuleFinding } from '../types'

export const a5InterleavedBlankRows: Rule = {
  code: 'A5',
  groupCode: 'A',
  run(ctx): RuleFinding[] {
    return ctx.workbook.sheets.flatMap((sheet) =>
      sheet.blankRowNumbers.map((rowNumber) => ({
        sheetName: sheet.name,
        rowNumber,
        message: `Sheet "${sheet.name}", dòng ${rowNumber} để trống nhưng phía dưới vẫn còn dữ liệu.`,
        suggestion:
          'Xoá hẳn dòng trống này. Một số công cụ import dừng đọc ở dòng trống đầu tiên, ' +
          'khi đó toàn bộ dòng bên dưới sẽ không được import.',
      })),
    )
  },
}
