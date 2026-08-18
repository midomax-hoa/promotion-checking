import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import {
  InvalidWorkbookError,
  readPromotionWorkbook,
} from '@/lib/excel/promotion-workbook'

const HEADER = [
  'Mã',
  'Mã hiệu',
  'Mặt hàng',
  'Đặc tính',
  'Bộ đóng gói',
  'Giá niêm yết',
  'Số dư\r\n(Để trống nếu không giới hạn)',
  'Giá sau giảm',
  'Số tiền giảm',
  'Phần trăm giảm',
  'Kiểu ctkm',
  'Thời gian bắt đầu chương trình',
  'Thời gian kết thúc chương trình',
  'Tên ctkm',
]

/** Builds a real .xlsx in memory - no binary fixture committed to the repo. */
async function buildWorkbook(
  sheets: { name: string; rows: unknown[][] }[],
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name)
    for (const row of sheet.rows) worksheet.addRow(row)
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}

const dataRow = (overrides: Record<number, unknown> = {}) => {
  const row: unknown[] = [
    'KMAP1',
    'KMAP1.L',
    'Áo bóng bàn',
    'Xanh size L',
    'Chiếc',
    289000,
    null,
    159000,
    130000,
    null,
    'Giảm giá theo số tiền',
    new Date(Date.UTC(2026, 7, 1)),
    new Date(Date.UTC(2026, 7, 31)),
    '2608GST130K',
  ]
  for (const [index, value] of Object.entries(overrides)) row[Number(index)] = value
  return row
}

describe('readPromotionWorkbook - a well-formed file', () => {
  it('reads every sheet, keeps Excel row numbers, and groups programs', async () => {
    const bytes = await buildWorkbook([
      { name: 'Key', rows: [HEADER, dataRow(), dataRow({ 1: 'KMAP1.M' })] },
      {
        name: 'Giảm phần trăm',
        rows: [HEADER, dataRow({ 8: null, 9: 0.5, 10: 'Giảm giá theo phần trăm', 13: '2608GPT50%' })],
      },
    ])
    const result = await readPromotionWorkbook(bytes, 'test.xlsx')

    expect(result.sheets.map((sheet) => [sheet.name, sheet.rowCount])).toEqual([
      ['Key', 2],
      ['Giảm phần trăm', 1],
    ])
    expect(result.rows).toHaveLength(3)
    // Header is row 1, so the first data row must report 2.
    expect(result.rows.map((row) => row.rowNumber)).toEqual([2, 3, 2])
    expect(result.programs.map((program) => program.name)).toEqual(['2608GST130K', '2608GPT50%'])
    expect(result.missingRequiredColumns).toEqual([])
  })

  it('matches the Số dư header that carries a line break', async () => {
    const bytes = await buildWorkbook([{ name: 'Key', rows: [HEADER, dataRow({ 6: 100 })] }])
    const result = await readPromotionWorkbook(bytes, 'test.xlsx')
    expect(result.rows[0].usageLimit).toBe(100)
    expect(result.sheets[0].mappedColumns.usageLimit).toContain('Số dư')
  })

  it('reads dates as the local day the author typed', async () => {
    const bytes = await buildWorkbook([{ name: 'Key', rows: [HEADER, dataRow()] }])
    const { rows } = await readPromotionWorkbook(bytes, 'test.xlsx')
    expect([rows[0].startAt?.getMonth(), rows[0].startAt?.getDate()]).toEqual([7, 1])
    expect(rows[0].endAt?.getDate()).toBe(31)
  })

  it('hashes the bytes, so the same file is recognisable on re-upload', async () => {
    const bytes = await buildWorkbook([{ name: 'Key', rows: [HEADER, dataRow()] }])
    const first = await readPromotionWorkbook(bytes, 'a.xlsx')
    const second = await readPromotionWorkbook(bytes, 'b.xlsx')
    expect(first.fileHash).toMatch(/^[0-9a-f]{64}$/)
    expect(first.fileHash).toBe(second.fileHash)
  })
})

describe('readPromotionWorkbook - broken content is reported, not thrown', () => {
  it('records a sheet lacking required columns and reads the others anyway', async () => {
    const bytes = await buildWorkbook([
      { name: 'Hướng dẫn', rows: [['Cách dùng'], ['Nhập đúng cột']] },
      { name: 'Key', rows: [HEADER, dataRow()] },
    ])
    const result = await readPromotionWorkbook(bytes, 'test.xlsx')

    expect(result.missingRequiredColumns).toEqual([
      { sheetName: 'Hướng dẫn', missing: ['sku', 'discountTypeRaw', 'programName'] },
    ])
    expect(result.sheets.map((sheet) => sheet.name)).toContain('Hướng dẫn')
    expect(result.rows).toHaveLength(1)
  })

  it('flags an unreadable date without substituting anything', async () => {
    const bytes = await buildWorkbook([
      { name: 'Key', rows: [HEADER, dataRow({ 11: 'tháng 8 nha' })] },
    ])
    const { rows } = await readPromotionWorkbook(bytes, 'test.xlsx')
    expect(rows[0].startAt).toBeNull()
    expect(rows[0].issues.startAt).toBe('unparsable-date')
    expect(rows[0].endAt).not.toBeNull()
  })

  it('skips blank spacer rows but keeps the row numbers after them honest', async () => {
    const bytes = await buildWorkbook([
      { name: 'Key', rows: [HEADER, dataRow(), [], dataRow({ 1: 'KMAP1.M' })] },
    ])
    const { rows, sheets } = await readPromotionWorkbook(bytes, 'test.xlsx')
    expect(sheets[0].rowCount).toBe(2)
    expect(rows.map((row) => row.rowNumber)).toEqual([2, 4])
  })

  it('reads a workbook with no data rows', async () => {
    const bytes = await buildWorkbook([{ name: 'Key', rows: [HEADER] }])
    const result = await readPromotionWorkbook(bytes, 'test.xlsx')
    expect(result.rows).toEqual([])
    expect(result.programs).toEqual([])
    expect(result.missingRequiredColumns).toEqual([])
  })
})

describe('readPromotionWorkbook - files that are not workbooks', () => {
  it('rejects a renamed non-spreadsheet by its bytes, not its extension', async () => {
    const bytes = new TextEncoder().encode('id,name\n1,test\n')
    await expect(readPromotionWorkbook(bytes, 'promotion.xlsx')).rejects.toBeInstanceOf(
      InvalidWorkbookError,
    )
  })

  it('rejects an empty file', async () => {
    await expect(readPromotionWorkbook(new Uint8Array(0), 'empty.xlsx')).rejects.toBeInstanceOf(
      InvalidWorkbookError,
    )
  })

  it('rejects an upload above the size cap before parsing it', async () => {
    const oversized = new Uint8Array(21 * 1024 * 1024)
    oversized.set([0x50, 0x4b, 0x03, 0x04])
    await expect(readPromotionWorkbook(oversized, 'big.xlsx')).rejects.toThrow(/20 MB/)
  })
})

/**
 * Checked against the real file when it is present. It holds live business data
 * and is git-ignored, so this is skipped rather than failed on a clean checkout.
 */
const REAL_FILE = 'promotion.t8.xlsx'
const hasRealFile = existsSync(REAL_FILE)

describe.skipIf(!hasRealFile)('readPromotionWorkbook - the real promotion.t8.xlsx', () => {
  it('matches the figures the phase was specified against', async () => {
    const bytes = new Uint8Array(await readFile(REAL_FILE))
    const startedAt = performance.now()
    const result = await readPromotionWorkbook(bytes, REAL_FILE)
    const elapsedMs = performance.now() - startedAt

    expect(result.sheets.map((sheet) => [sheet.name, sheet.rowCount])).toEqual([
      ['Key', 3929],
      ['Giảm phần trăm', 2],
    ])
    expect(result.rows).toHaveLength(3931)
    expect(result.missingRequiredColumns).toEqual([])

    const keyPrograms = new Set(
      result.rows.filter((row) => row.sheetName === 'Key').map((row) => row.programName),
    )
    expect(keyPrograms.size).toBe(154)

    // The headline finding from the plan: 279 rows discounting 0đ.
    const zeroDiscount = result.programs.find((program) => program.name === '2608GST0K')
    expect(zeroDiscount?.rows).toHaveLength(279)

    // A blow-up guard, not a performance target. Parsing this file takes
    // 1,1-1,3 s on an idle machine, but this suite runs its files in parallel
    // and two of them parse the same 3.931 row workbook, so the wall clock here
    // measures contention as much as code. The budget is set where an accidental
    // O(n^2) would still trip it while a loaded machine would not.
    // The real end-to-end figure lives in the phase 05 plan: 2,36 s for
    // read + 31 rules + database write, against an 8 s requirement.
    expect(elapsedMs).toBeLessThan(8000)
  })

  it('reads the first row exactly as the file shows it', async () => {
    const bytes = new Uint8Array(await readFile(REAL_FILE))
    const { rows } = await readPromotionWorkbook(bytes, REAL_FILE)
    const first = rows[0]

    expect(first.rowNumber).toBe(2)
    expect(first.sku).toBe('KMAP231728F.L')
    expect(first.programName).toBe('2608GST130K')
    expect(first.discountAmount).toBe(130000)
    expect(first.discountType).toBe('fixed_amount')
    expect([first.startAt?.getFullYear(), first.startAt?.getMonth(), first.startAt?.getDate()],
    ).toEqual([2026, 7, 1])
    expect([first.endAt?.getFullYear(), first.endAt?.getMonth(), first.endAt?.getDate()]).toEqual([
      2026, 7, 31,
    ])
    expect(first.issues).toEqual({})
  })

  it('finds the Số dư column despite its rich-text header', async () => {
    const bytes = new Uint8Array(await readFile(REAL_FILE))
    const { sheets } = await readPromotionWorkbook(bytes, REAL_FILE)
    expect(sheets[0].mappedColumns.usageLimit).toContain('Số dư')
  })
})
