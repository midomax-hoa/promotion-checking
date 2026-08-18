import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import ExcelJS from 'exceljs'
import { beforeAll, describe, expect, it } from 'vitest'
import { unwrapCell } from '@/lib/excel/cell-value'
import {
  hasSpreadsheetSignature,
  hashFile,
  readBuffered,
  readStreaming,
  readWorkbook,
  type RawSheet,
} from '@/lib/excel/excel-reader'

describe('hasSpreadsheetSignature', () => {
  it('accepts the zip header every .xlsx starts with', () => {
    expect(hasSpreadsheetSignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14]))).toBe(true)
  })

  it('accepts the OLE2 header of a legacy .xls', () => {
    expect(hasSpreadsheetSignature(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1]))).toBe(true)
  })

  it('rejects a CSV or PDF renamed to .xlsx', () => {
    expect(hasSpreadsheetSignature(new TextEncoder().encode('id,name\n'))).toBe(false)
    expect(hasSpreadsheetSignature(new TextEncoder().encode('%PDF-1.7'))).toBe(false)
  })

  it('rejects a file too short to carry a signature', () => {
    expect(hasSpreadsheetSignature(new Uint8Array([0x50, 0x4b]))).toBe(false)
    expect(hasSpreadsheetSignature(new Uint8Array(0))).toBe(false)
  })
})

describe('hashFile', () => {
  it('is a stable SHA-256 hex digest', () => {
    // Reference value for the empty input, from the SHA-256 specification.
    expect(hashFile(new Uint8Array(0))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  it('changes when a single byte changes', () => {
    expect(hashFile(new Uint8Array([1, 2, 3]))).not.toBe(hashFile(new Uint8Array([1, 2, 4])))
  })
})

/**
 * exceljs writes `xl/workbook.xml` as the LAST zip entry, which its own
 * streaming reader usually cannot handle (workbook-reader.js:303 dereferences
 * an undefined `this.model`).
 *
 * "Usually", not "always": measured on 2026-08-18 with exceljs 4.4.0, sixty
 * sequential reads of the same buffer threw 59 times, while sixty concurrent
 * reads threw none - how much of the stream lands per tick decides whether
 * `workbook.xml` has been parsed by the time a worksheet entry is reached. So
 * which path `readWorkbook` takes for these files is genuinely a race, and only
 * its *result* can be asserted. That is what the fallback is there to
 * guarantee, and what this test pins down.
 */
describe('readWorkbook - exceljs-written files', () => {
  async function exceljsWorkbook(): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Key')
    sheet.addRow(['Mã hiệu', 'Kiểu ctkm', 'Tên ctkm'])
    sheet.addRow(['A1', 'Đồng giá', 'CT1'])
    return new Uint8Array(await workbook.xlsx.writeBuffer())
  }

  it('is read the same way whichever path wins the race', async () => {
    const bytes = await exceljsWorkbook()
    // Whether streaming throws here or not, the fallback covers it.
    const streamed = await readStreaming(bytes).catch(() => null)
    if (streamed !== null) {
      expect(streamed[0].dataRows).toEqual([{ rowNumber: 2, cells: ['A1', 'Đồng giá', 'CT1'] }])
    }
    expect((await readWorkbook(bytes, 'built.xlsx')).sheets[0].dataRows).toEqual([
      { rowNumber: 2, cells: ['A1', 'Đồng giá', 'CT1'] },
    ])
  })

  it('is read anyway, through the fallback', async () => {
    const result = await readWorkbook(await exceljsWorkbook(), 'built.xlsx')
    expect(result.sheets).toHaveLength(1)
    expect(result.sheets[0].name).toBe('Key')
    expect(result.sheets[0].headerCells).toEqual(['Mã hiệu', 'Kiểu ctkm', 'Tên ctkm'])
    expect(result.sheets[0].dataRows).toEqual([
      { rowNumber: 2, cells: ['A1', 'Đồng giá', 'CT1'] },
    ])
  })
})

const REAL_FILE = 'promotion.t8.xlsx'

/**
 * Generous because the work is real, not because it hides anything: measured on
 * 2026-08-18, one `readWorkbook` of this file costs ~1,7 s and one `readBuffered`
 * ~1,25 s on an idle machine. The suite runs its files in parallel, so the
 * default 5 s per-test budget was a coin flip under contention.
 */
const REAL_FILE_PARSE_TIMEOUT_MS = 60_000

/** Git-ignored business data: verified when present, skipped on a clean checkout. */
describe.skipIf(!existsSync(REAL_FILE))('readWorkbook - the real promotion.t8.xlsx', () => {
  const cellAt = (sheet: RawSheet, rowNumber: number, column: number) =>
    unwrapCell(sheet.dataRows.find((row) => row.rowNumber === rowNumber)?.cells[column - 1])

  /**
   * Parsed once for the whole block. Every test used to re-read and re-parse
   * the same 3.931 row workbook - five tests paying for three `readWorkbook`
   * runs and two `readStreaming`/`readBuffered` pairs between them. The inputs
   * are identical and nothing below mutates a result, so the only thing the
   * repetition bought was wall clock and a flaky timeout.
   */
  let result: Awaited<ReturnType<typeof readWorkbook>>
  let streamed: RawSheet[]
  let buffered: RawSheet[]

  beforeAll(async () => {
    const input = new Uint8Array(await readFile(REAL_FILE))
    ;[result, streamed, buffered] = await Promise.all([
      readWorkbook(input, REAL_FILE),
      readStreaming(input),
      readBuffered(input),
    ])
  }, REAL_FILE_PARSE_TIMEOUT_MS)

  it('keeps every worksheet and the true row numbers', () => {
    expect(result.sheets.map((sheet) => sheet.name)).toEqual(['Key', 'Giảm phần trăm'])
    expect(result.sheets[0].dataRows).toHaveLength(3929)
    expect(result.sheets[1].dataRows).toHaveLength(2)
    expect(result.sheets[0].dataRows[0].rowNumber).toBe(2)
    expect(result.sheets[0].dataRows.at(-1)?.rowNumber).toBe(3930)
  })

  /**
   * Each reader is wrong where the other is right - both confirmed against the
   * raw XML on 2026-08-18. These tests pin the defects down, so an exceljs
   * upgrade that fixes either one surfaces here instead of drifting unnoticed.
   *
   *   sheet1.xml  I51  -> `<c r="I51"><f t="shared" si="0"/><v>0</v></c>`
   *   sharedStrings[1782] -> "Quả bóng chuyền trẻ em Kamito Game Ball"
   */
  describe('known exceljs defects', () => {
    it('buffered loses a shared-formula result of 0 - streaming does not', () => {
      expect(cellAt(streamed[0], 51, 9)).toBe(0)
      expect(cellAt(buffered[0], 51, 9)).toBeNull()
    })

    it('streaming mangles a character on a chunk boundary - buffered does not', () => {
      expect(cellAt(streamed[0], 801, 3)).toContain('�')
      expect(cellAt(buffered[0], 801, 3)).toBe('Quả bóng chuyền trẻ em Kamito Game Ball')
    })
  })

  it('takes the correct value from each reader', () => {
    const { sheets } = result

    // The 0 that only streaming reports - 279 such rows drive the headline finding.
    expect(cellAt(sheets[0], 51, 9)).toBe(0)
    // The text that only buffered decodes correctly.
    expect(cellAt(sheets[0], 801, 3)).toBe('Quả bóng chuyền trẻ em Kamito Game Ball')
  })

  it('leaves no replacement characters anywhere in the workbook', () => {
    const { sheets } = result

    const damaged = sheets.flatMap((sheet) =>
      sheet.dataRows.flatMap((row) =>
        row.cells
          .map(unwrapCell)
          .filter((value) => typeof value === 'string' && value.includes('�'))
          .map((value) => `${sheet.name}!${row.rowNumber}: ${String(value)}`),
      ),
    )
    expect(damaged).toEqual([])
  })
})
