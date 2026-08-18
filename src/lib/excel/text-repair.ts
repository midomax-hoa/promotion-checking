/**
 * Repairs Vietnamese text mangled by the `exceljs` streaming reader.
 *
 * Verified against `promotion.t8.xlsx` on 2026-08-18. `lib/utils/parse-sax.js`
 * decodes every stream chunk on its own (`saxesParser.write(bufferToString(chunk))`,
 * line 21) with no `StringDecoder`, so a multi-byte character landing on a chunk
 * boundary is decoded as U+FFFD replacement characters. In the sample file that
 * hits exactly one cell - C801, "Quả bóng chuyền trẻ em" arriving as
 * "Quả bóng chuyền tr??em".
 *
 * Why bother over one cell in ~55,000: `Kiểu ctkm` is Vietnamese too, and a
 * mangled "Giảm giá theo số tiền" would be reported as an unknown discount type.
 * A checking tool that invents findings is worse than one that misses them.
 *
 * Why not just use the buffered reader, which decodes correctly: it drops the
 * cached result of a shared-formula cell when that result is 0, which would
 * turn all 279 zero-discount rows into empty cells - the exact finding this
 * tool exists to surface. Each reader is right where the other is wrong, so the
 * streamed values stay authoritative and only the broken strings are replaced.
 */

import type { RawSheet } from './excel-reader'

/** U+FFFD: what a decoder emits when it meets a truncated byte sequence. */
const REPLACEMENT_CHAR = '�'

function isCorrupt(value: unknown): boolean {
  return typeof value === 'string' && value.includes(REPLACEMENT_CHAR)
}

/** True when any cell shows decoder damage - the only case worth a second read. */
export function hasCorruptText(sheets: readonly RawSheet[]): boolean {
  return sheets.some(
    (sheet) =>
      sheet.headerCells.some(isCorrupt) ||
      sheet.dataRows.some((row) => row.cells.some(isCorrupt)),
  )
}

/** Takes the replacement only when it is intact text; otherwise keeps the original. */
function pick(streamed: unknown, buffered: unknown): unknown {
  if (!isCorrupt(streamed)) return streamed
  return typeof buffered === 'string' && !isCorrupt(buffered) ? buffered : streamed
}

/**
 * Returns the streamed sheets with only their damaged strings replaced.
 * Everything else - numbers, dates, formula results - stays as streamed.
 */
export function repairText(
  streamed: readonly RawSheet[],
  buffered: readonly RawSheet[],
): RawSheet[] {
  return streamed.map((sheet, sheetIndex) => {
    // Match by name first; fall back to position if a reader named a sheet differently.
    const other =
      buffered.find((candidate) => candidate.name === sheet.name) ?? buffered[sheetIndex]
    if (!other) return sheet

    const otherRows = new Map(other.dataRows.map((row) => [row.rowNumber, row.cells]))

    return {
      ...sheet,
      headerCells: sheet.headerCells.map((cell, index) => pick(cell, other.headerCells[index])),
      dataRows: sheet.dataRows.map((row) => {
        const otherCells = otherRows.get(row.rowNumber)
        if (!otherCells) return row
        return { ...row, cells: row.cells.map((cell, index) => pick(cell, otherCells[index])) }
      }),
    }
  })
}
