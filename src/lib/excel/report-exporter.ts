/**
 * Turns a saved run back into an Excel file the file's author can act on.
 *
 * The original upload is loaded and *annotated*, never rebuilt: it is sent back
 * to the person who wrote it, and they need their own columns, order and
 * formatting intact to find the cell being complained about. Only three things
 * are added - a row fill, two trailing columns, and a summary sheet in front.
 *
 * Nothing is executed or evaluated from the uploaded file; it is read as data.
 */

import ExcelJS, { type Worksheet } from 'exceljs'
import { SEVERITY_FILL, worstSeverity, type ReportFinding } from './report-styles'
import { addSummarySheet, type ReportRunInfo } from './report-summary-sheet'

export type { ReportFinding, ReportRunInfo }

export const WARNING_COLUMN_HEADER = 'Cảnh báo'
export const SUGGESTION_COLUMN_HEADER = 'Gợi ý sửa'

/** Wide enough to read a full Vietnamese sentence without opening the cell. */
const ADDED_COLUMN_WIDTH = 52

type RowAnnotation = {
  severity: string
  warnings: string[]
  suggestions: string[]
}

/** Groups the findings of one sheet by the Excel row they point at. */
function annotationsBySheet(findings: readonly ReportFinding[]): Map<string, Map<number, RowAnnotation>> {
  const bySheet = new Map<string, Map<number, RowAnnotation>>()

  for (const finding of findings) {
    if (finding.sheetName == null || finding.rowNumber == null) continue
    const rows = bySheet.get(finding.sheetName) ?? new Map<number, RowAnnotation>()
    const current = rows.get(finding.rowNumber)
    const warning = `${finding.ruleCode}: ${finding.message}`

    rows.set(finding.rowNumber, {
      severity: worstSeverity([current?.severity, finding.severity]),
      warnings: [...(current?.warnings ?? []), warning],
      // A row hit by three rules often gets the same advice twice; saying it once is enough.
      suggestions: dedupe([...(current?.suggestions ?? []), finding.suggestion]),
    })
    bySheet.set(finding.sheetName, rows)
  }

  return bySheet
}

function dedupe(values: readonly (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

/**
 * The first row carrying anything, which is what the reader treated as the
 * header. Not always Excel row 1: a sheet whose title block was deleted starts
 * lower down, and writing the new headers into the blank row above the real one
 * would put them nowhere useful.
 */
function headerRowNumber(sheet: Worksheet): number {
  let first = 0
  sheet.eachRow((row) => {
    if (first === 0) first = row.number
  })
  return first || 1
}

function annotateSheet(sheet: Worksheet, rows: Map<number, RowAnnotation>): void {
  // A sheet nobody complained about is returned exactly as it arrived - an
  // instructions tab must not come back with filter arrows and two new columns.
  if (rows.size === 0) return

  const headerRow = headerRowNumber(sheet)
  // Appended after the widest used column so no original cell is overwritten.
  const warningColumn = sheet.columnCount + 1
  const suggestionColumn = warningColumn + 1
  const lastColumn = suggestionColumn

  const header = sheet.getRow(headerRow)
  header.getCell(warningColumn).value = WARNING_COLUMN_HEADER
  header.getCell(suggestionColumn).value = SUGGESTION_COLUMN_HEADER
  header.getCell(warningColumn).font = { bold: true }
  header.getCell(suggestionColumn).font = { bold: true }
  sheet.getColumn(warningColumn).width = ADDED_COLUMN_WIDTH
  sheet.getColumn(suggestionColumn).width = ADDED_COLUMN_WIDTH

  for (const [rowNumber, annotation] of rows) {
    // A finding pointing at the header or past the last row is a mapping bug,
    // not a data row - colouring it would move the complaint to the wrong cell.
    if (rowNumber <= headerRow || rowNumber > sheet.rowCount) continue
    const row = sheet.getRow(rowNumber)
    const fill = SEVERITY_FILL[annotation.severity as keyof typeof SEVERITY_FILL]

    if (fill) {
      for (let column = 1; column <= lastColumn; column += 1) {
        row.getCell(column).fill = fill
      }
    }
    row.getCell(warningColumn).value = annotation.warnings.join('\n')
    row.getCell(suggestionColumn).value = annotation.suggestions.join('\n')
    row.getCell(warningColumn).alignment = { wrapText: true, vertical: 'top' }
    row.getCell(suggestionColumn).alignment = { wrapText: true, vertical: 'top' }
  }

  sheet.views = [{ state: 'frozen', ySplit: headerRow }]
  sheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow, column: lastColumn },
  }
}

/**
 * ExcelJS writes tabs in `orderNo` order but leaves the property out of its
 * published typings. Verified against exceljs 4.4 on 2026-08-18: setting it and
 * writing the buffer really does reorder the tabs on reload.
 */
type OrderedWorksheet = Worksheet & { orderNo: number }

/** Puts the summary in front of the user's own sheets - it is the first thing to read. */
function moveSummaryFirst(workbook: ExcelJS.Workbook, summary: Worksheet): void {
  for (const sheet of workbook.worksheets as OrderedWorksheet[]) {
    if (sheet.id !== summary.id) sheet.orderNo += 1
  }
  ;(summary as OrderedWorksheet).orderNo = 0
}

export async function buildReportWorkbook(
  originalFile: Uint8Array,
  run: ReportRunInfo,
  findings: readonly ReportFinding[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(toArrayBuffer(originalFile))

  const bySheet = annotationsBySheet(findings)
  for (const sheet of workbook.worksheets) {
    annotateSheet(sheet, bySheet.get(sheet.name) ?? new Map())
  }

  moveSummaryFirst(workbook, addSummarySheet(workbook, run, findings))

  const written = await workbook.xlsx.writeBuffer()
  return Buffer.from(written)
}

/** Node's Buffer may be a view into a larger pool; ExcelJS needs the exact bytes. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}
