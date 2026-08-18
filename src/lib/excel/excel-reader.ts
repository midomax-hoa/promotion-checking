/**
 * Reads an uploaded workbook into raw per-sheet cell arrays.
 *
 * Uses the `exceljs` streaming reader rather than `workbook.xlsx.load`. Both
 * produce identical values for this file, but measured on `promotion.t8.xlsx`
 * (312 KB, 3931 data rows, 2026-08-18) the streaming reader takes ~85 ms
 * against ~1100 ms for the buffered loader, and it never holds the whole sheet
 * in memory - which is what keeps a 20 MB upload from becoming a heap spike.
 *
 * Nothing here interprets a value; that belongs to the normaliser. This layer
 * only guarantees two things: every worksheet is visited, and every row keeps
 * its true Excel row number.
 */

import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import ExcelJS from 'exceljs'
import { hasCorruptText, repairText } from './text-repair'

export type RawRow = {
  /** Real Excel row number, 1-based, header included. */
  rowNumber: number
  /** 0-based array of raw `exceljs` cell values; index 0 is column A. */
  cells: unknown[]
}

export type RawSheet = {
  name: string
  /** Empty when the sheet has no rows at all. */
  headerCells: unknown[]
  dataRows: RawRow[]
}

export type RawWorkbook = {
  fileName: string
  fileHash: string
  sheets: RawSheet[]
}

/** `.xlsx` is a zip; `.xls` is an OLE2 compound file. Checked before parsing. */
const SIGNATURES: readonly (readonly number[])[] = [
  [0x50, 0x4b, 0x03, 0x04], // PK.. - xlsx / xlsm
  [0xd0, 0xcf, 0x11, 0xe0], // OLE2 - legacy xls
]

export function hasSpreadsheetSignature(bytes: Uint8Array): boolean {
  return SIGNATURES.some((signature) =>
    signature.every((byte, index) => bytes[index] === byte),
  )
}

export function hashFile(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * `row.values` is 1-based with a hole at index 0, and its length varies with the
 * last non-empty cell. Re-indexed to a dense 0-based array of a fixed width so
 * the column map can address columns positionally.
 */
function toCells(row: ExcelJS.Row, width: number): unknown[] {
  const cells = new Array<unknown>(width).fill(null)
  for (let column = 1; column <= width; column += 1) {
    cells[column - 1] = row.getCell(column).value ?? null
  }
  return cells
}

function rowWidth(row: ExcelJS.Row): number {
  const values = row.values
  return Array.isArray(values) ? Math.max(0, values.length - 1) : 0
}

/**
 * `WorksheetReader` carries `name` and `id` at runtime (both confirmed against
 * exceljs 4.4.0), but its bundled `.d.ts` declares neither. Cast rather than
 * augment the module, and fall back to the sheet index so a sheet can never
 * end up nameless in the report.
 */
function worksheetName(worksheet: unknown, index: number): string {
  const name = (worksheet as { name?: unknown }).name
  return typeof name === 'string' && name.length > 0 ? name : `Sheet ${index + 1}`
}

/** Splits an ordered row list into the header row and the data rows below it. */
function toSheet(name: string, rows: ExcelJS.Row[]): RawSheet {
  const [header, ...rest] = rows
  return {
    name,
    // The first row carrying anything is the header; leading blank rows are skipped.
    headerCells: header ? toCells(header, rowWidth(header)) : [],
    // Rows may be narrower or wider than the header - readers index defensively.
    dataRows: rest.map((row) => ({ rowNumber: row.number, cells: toCells(row, rowWidth(row)) })),
  }
}

/** Exported so a test can prove it agrees with `readBuffered` on the same file. */
export async function readStreaming(bytes: Uint8Array): Promise<RawSheet[]> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(Readable.from(Buffer.from(bytes)), {
    worksheets: 'emit',
    sharedStrings: 'cache',
    styles: 'cache',
  })

  const sheets: RawSheet[] = []
  for await (const worksheet of reader) {
    const rows: ExcelJS.Row[] = []
    for await (const row of worksheet) rows.push(row)
    sheets.push(toSheet(worksheetName(worksheet, sheets.length), rows))
  }
  return sheets
}

/**
 * Slower, holds the sheet in memory, and drops a shared-formula result when it
 * is 0 - which would hide every zero-discount row. Decodes text correctly
 * though, so it serves two narrow purposes: repairing mangled strings, and
 * reading files the streaming reader refuses outright.
 */
export async function readBuffered(bytes: Uint8Array): Promise<RawSheet[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer)

  return workbook.worksheets.map((worksheet, index) => {
    const rows: ExcelJS.Row[] = []
    worksheet.eachRow((row) => rows.push(row))
    return toSheet(worksheetName(worksheet, index), rows)
  })
}

export async function readWorkbook(bytes: Uint8Array, fileName: string): Promise<RawWorkbook> {
  let sheets: RawSheet[]
  try {
    sheets = await readStreaming(bytes)
    // Streaming is authoritative for values but mangles the odd multi-byte
    // character; see text-repair.ts for why each reader needs the other.
    if (hasCorruptText(sheets)) {
      sheets = repairText(sheets, await readBuffered(bytes))
    }
  } catch {
    // exceljs 4.4.0 streaming assumes `xl/workbook.xml` precedes the worksheets
    // in the zip. Excel writes it third, but exceljs itself writes it LAST, and
    // then `_parseWorksheet` dereferences an undefined `this.model` (verified
    // 2026-08-18, workbook-reader.js:303). Any tool building files that way -
    // plausibly the in-house exporter - would otherwise be unreadable.
    //
    // Last resort, and lossy: this reader cannot report a 0 held by a shared
    // formula. Better than refusing the file, but the streaming path above is
    // the one that must handle anything Excel itself wrote.
    sheets = await readBuffered(bytes)
  }
  return { fileName, fileHash: hashFile(bytes), sheets }
}
