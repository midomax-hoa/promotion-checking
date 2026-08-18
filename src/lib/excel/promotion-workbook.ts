/**
 * The one entry point the rest of the app uses: bytes in, `WorkbookReadResult`
 * out. Wires read -> map columns -> normalise rows -> group programs.
 *
 * Never throws for bad *content*. A sheet missing its required columns is
 * recorded and skipped, an unreadable cell becomes an issue on its row - the
 * report is meant to list every problem at once, not stop at the first.
 * A file that is not a spreadsheet at all does throw, since there is nothing
 * to report on.
 */

import { mapColumns } from './column-mapper'
import { hasSpreadsheetSignature, readWorkbook } from './excel-reader'
import { groupPrograms } from './program-grouper'
import { isEmptyRow, normalizeRow } from './row-normalizer'
import type { PromotionRow, SheetSummary, WorkbookReadResult } from './types'

/** Matches the upload cap enforced at the API boundary. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

export class InvalidWorkbookError extends Error {}

function assertReadable(bytes: Uint8Array): void {
  if (bytes.byteLength === 0) {
    throw new InvalidWorkbookError('Tệp rỗng, không có gì để đọc.')
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    const limitMb = Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)
    throw new InvalidWorkbookError(`Tệp vượt quá giới hạn ${limitMb} MB.`)
  }
  // Checked on the bytes, not the extension: renaming a .zip to .xlsx must not
  // get it as far as the XML parser.
  if (!hasSpreadsheetSignature(bytes)) {
    throw new InvalidWorkbookError('Tệp không phải định dạng Excel (.xlsx hoặc .xls).')
  }
}

export async function readPromotionWorkbook(
  bytes: Uint8Array,
  fileName: string,
): Promise<WorkbookReadResult> {
  assertReadable(bytes)

  const workbook = await readWorkbook(bytes, fileName)
  const sheets: SheetSummary[] = []
  const missingRequiredColumns: WorkbookReadResult['missingRequiredColumns'] = []
  const rows: PromotionRow[] = []

  for (const sheet of workbook.sheets) {
    const mapping = mapColumns(sheet.headerCells)
    // Blank spacer rows are counted for rule A5 but produce no promotion row.
    const dataRows = sheet.dataRows.filter((row) => !isEmptyRow(row))

    sheets.push({
      name: sheet.name,
      rowCount: dataRows.length,
      mappedColumns: mapping.matchedHeaders,
    })

    if (mapping.missingRequired.length > 0) {
      // Reported, not thrown: an instructions or notes sheet is normal, and the
      // user still needs to see that it was found and why it was skipped.
      missingRequiredColumns.push({ sheetName: sheet.name, missing: [...mapping.missingRequired] })
      continue
    }

    for (const row of dataRows) {
      rows.push(normalizeRow(sheet.name, row, mapping))
    }
  }

  return {
    fileName,
    fileHash: workbook.fileHash,
    sheets,
    rows,
    programs: groupPrograms(rows),
    missingRequiredColumns,
  }
}
