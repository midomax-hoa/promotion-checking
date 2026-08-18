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
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from './upload-limits'
import type { RawRow } from './excel-reader'

export { MAX_UPLOAD_BYTES }

export class InvalidWorkbookError extends Error {}

function assertReadable(bytes: Uint8Array): void {
  if (bytes.byteLength === 0) {
    throw new InvalidWorkbookError('Tệp rỗng, không có gì để đọc.')
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new InvalidWorkbookError(`Tệp vượt quá giới hạn ${MAX_UPLOAD_MB} MB.`)
  }
  // Checked on the bytes, not the extension: renaming a .zip to .xlsx must not
  // get it as far as the XML parser.
  if (!hasSpreadsheetSignature(bytes)) {
    throw new InvalidWorkbookError('Tệp không phải định dạng Excel (.xlsx hoặc .xls).')
  }
}

/**
 * Blank rows with data both above and below them. Leading and trailing blanks
 * are ignored on purpose - only a gap inside the block is worth reporting.
 */
function interleavedBlankRows(dataRows: readonly RawRow[]): number[] {
  const lastFilled = dataRows.findLastIndex((row) => !isEmptyRow(row))
  const firstFilled = dataRows.findIndex((row) => !isEmptyRow(row))
  if (firstFilled === -1) return []
  return dataRows
    .slice(firstFilled, lastFilled)
    .filter((row) => isEmptyRow(row))
    .map((row) => row.rowNumber)
}

export async function readPromotionWorkbook(
  bytes: Uint8Array,
  fileName: string,
): Promise<WorkbookReadResult> {
  assertReadable(bytes)

  // Passing the signature check is not the same as being readable: a genuine
  // .xls carries a valid OLE2 header that neither reader can open. Wrapped so
  // the upload route answers "this file cannot be read" instead of a 500.
  let workbook: Awaited<ReturnType<typeof readWorkbook>>
  try {
    workbook = await readWorkbook(bytes, fileName)
  } catch (cause) {
    throw new InvalidWorkbookError(
      'Không mở được tệp. Nếu đây là file .xls đời cũ, hãy mở bằng Excel rồi lưu lại thành .xlsx.',
      { cause },
    )
  }
  const sheets: SheetSummary[] = []
  const missingRequiredColumns: WorkbookReadResult['missingRequiredColumns'] = []
  const rows: PromotionRow[] = []

  for (const sheet of workbook.sheets) {
    const mapping = mapColumns(sheet.headerCells)
    // Blank spacer rows are recorded for rule A5 but produce no promotion row.
    const dataRows = sheet.dataRows.filter((row) => !isEmptyRow(row))

    sheets.push({
      name: sheet.name,
      rowCount: dataRows.length,
      mappedColumns: mapping.matchedHeaders,
      blankRowNumbers: interleavedBlankRows(sheet.dataRows),
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
