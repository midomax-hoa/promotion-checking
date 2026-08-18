import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
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
 * streaming reader cannot handle (workbook-reader.js:303 dereferences an
 * undefined `this.model`). Every workbook built in these tests therefore
 * exercises the buffered fallback - this test pins that behaviour down so a
 * future exceljs upgrade that fixes the bug shows up here rather than silently.
 */
describe('readWorkbook - exceljs-written files', () => {
  async function exceljsWorkbook(): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Key')
    sheet.addRow(['Mã hiệu', 'Kiểu ctkm', 'Tên ctkm'])
    sheet.addRow(['A1', 'Đồng giá', 'CT1'])
    return new Uint8Array(await workbook.xlsx.writeBuffer())
  }

  it('trips the streaming reader', async () => {
    await expect(readStreaming(await exceljsWorkbook())).rejects.toThrow()
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

/** Git-ignored business data: verified when present, skipped on a clean checkout. */
describe.skipIf(!existsSync(REAL_FILE))('readWorkbook - the real promotion.t8.xlsx', () => {
  const bytes = async () => new Uint8Array(await readFile(REAL_FILE))
  const cellAt = (sheet: RawSheet, rowNumber: number, column: number) =>
    unwrapCell(sheet.dataRows.find((row) => row.rowNumber === rowNumber)?.cells[column - 1])

  it('keeps every worksheet and the true row numbers', async () => {
    const result = await readWorkbook(await bytes(), REAL_FILE)

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
    it('buffered loses a shared-formula result of 0 - streaming does not', async () => {
      const input = await bytes()
      const [streamed, buffered] = await Promise.all([readStreaming(input), readBuffered(input)])

      expect(cellAt(streamed[0], 51, 9)).toBe(0)
      expect(cellAt(buffered[0], 51, 9)).toBeNull()
    })

    it('streaming mangles a character on a chunk boundary - buffered does not', async () => {
      const input = await bytes()
      const [streamed, buffered] = await Promise.all([readStreaming(input), readBuffered(input)])

      expect(cellAt(streamed[0], 801, 3)).toContain('�')
      expect(cellAt(buffered[0], 801, 3)).toBe('Quả bóng chuyền trẻ em Kamito Game Ball')
    })
  })

  it('takes the correct value from each reader', async () => {
    const { sheets } = await readWorkbook(await bytes(), REAL_FILE)

    // The 0 that only streaming reports - 279 such rows drive the headline finding.
    expect(cellAt(sheets[0], 51, 9)).toBe(0)
    // The text that only buffered decodes correctly.
    expect(cellAt(sheets[0], 801, 3)).toBe('Quả bóng chuyền trẻ em Kamito Game Ball')
  })

  it('leaves no replacement characters anywhere in the workbook', async () => {
    const { sheets } = await readWorkbook(await bytes(), REAL_FILE)

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
