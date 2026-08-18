/**
 * The exported report, checked by reading the produced file back with ExcelJS.
 *
 * Asserting on the bytes rather than on the calls made to ExcelJS is deliberate:
 * the promise this feature makes is "the file opens in Excel with the broken
 * rows coloured", and only a round trip can show that.
 */

import ExcelJS from 'exceljs'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  SUGGESTION_COLUMN_HEADER,
  WARNING_COLUMN_HEADER,
  buildReportWorkbook,
  type ReportFinding,
  type ReportRunInfo,
} from '@/lib/excel/report-exporter'
import { SUMMARY_SHEET_NAME } from '@/lib/excel/report-summary-sheet'
import { SEVERITY_FILL } from '@/lib/excel/report-styles'

const RUN: ReportRunInfo = {
  fileName: 'promotion.t8.xlsx',
  createdAt: new Date(2026, 7, 18, 10, 12),
  totalSheets: 2,
  totalRows: 4,
  totalPrograms: 2,
  countCritical: 1,
  countDanger: 1,
  countWarn: 1,
}

const FINDINGS: ReportFinding[] = [
  {
    severity: 'critical',
    sheetName: 'Key',
    rowNumber: 2,
    programName: '2608GST0K',
    ruleCode: 'C2',
    message: 'Số tiền giảm bằng 0đ.',
    suggestion: 'Sửa cột "Số tiền giảm" thành số lớn hơn 0',
  },
  {
    // Same row as the critical one: the row must end up red, not yellow.
    severity: 'warn',
    sheetName: 'Key',
    rowNumber: 2,
    programName: '2608GST0K',
    ruleCode: 'C7',
    message: 'Giá sau giảm không tròn nghìn.',
    suggestion: 'Sửa cột "Số tiền giảm" thành số lớn hơn 0',
  },
  {
    severity: 'danger',
    sheetName: 'Key',
    rowNumber: 3,
    programName: '2608GST130K',
    ruleCode: 'B1',
    message: 'SKU không tồn tại trên Haravan.',
    suggestion: null,
  },
  {
    // No row to colour, so it can only survive on the summary sheet.
    severity: 'danger',
    sheetName: null,
    rowNumber: null,
    programName: null,
    ruleCode: 'A1',
    message: 'Sheet "Ghi chú" thiếu cột bắt buộc.',
    suggestion: 'Thêm cột Mã hiệu',
  },
]

async function makeOriginalWorkbook(): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  const key = workbook.addWorksheet('Key')
  key.addRow(['Mã hiệu', 'Tên ctkm', 'Số tiền giảm'])
  key.addRow(['KMAP240101.L', '2608GST0K', 0])
  key.addRow(['KHONG-CO', '2608GST130K', 130000])
  const other = workbook.addWorksheet('Giảm phần trăm')
  other.addRow(['Mã hiệu', 'Phần trăm giảm'])
  other.addRow(['KMAP240102.L', 0.1])
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}

describe('exporting a run as an annotated workbook', () => {
  let report: ExcelJS.Workbook

  beforeAll(async () => {
    const bytes = await buildReportWorkbook(await makeOriginalWorkbook(), RUN, FINDINGS)
    report = new ExcelJS.Workbook()
    await report.xlsx.load(new Uint8Array(bytes).buffer as ArrayBuffer)
  })

  it('puts the summary sheet first and keeps the original sheets after it', () => {
    expect(report.worksheets.map((sheet) => sheet.name)).toEqual([
      SUMMARY_SHEET_NAME,
      'Key',
      'Giảm phần trăm',
    ])
  })

  it('leaves the original columns untouched, in their original order', () => {
    const header = report.getWorksheet('Key')!.getRow(1)
    expect([header.getCell(1).value, header.getCell(2).value, header.getCell(3).value]).toEqual([
      'Mã hiệu',
      'Tên ctkm',
      'Số tiền giảm',
    ])
    expect(report.getWorksheet('Key')!.getRow(2).getCell(1).value).toBe('KMAP240101.L')
  })

  it('adds the two report columns after the last original one', () => {
    const header = report.getWorksheet('Key')!.getRow(1)
    expect(header.getCell(4).value).toBe(WARNING_COLUMN_HEADER)
    expect(header.getCell(5).value).toBe(SUGGESTION_COLUMN_HEADER)
  })

  it('gathers every finding of one row into its warning cell', () => {
    const warning = String(report.getWorksheet('Key')!.getRow(2).getCell(4).value)
    expect(warning).toContain('C2: Số tiền giảm bằng 0đ.')
    expect(warning).toContain('C7: Giá sau giảm không tròn nghìn.')
    expect(warning.split('\n')).toHaveLength(2)
  })

  it('says the same suggestion once even when several rules give it', () => {
    const suggestion = String(report.getWorksheet('Key')!.getRow(2).getCell(5).value)
    expect(suggestion).toBe('Sửa cột "Số tiền giảm" thành số lớn hơn 0')
  })

  it('colours a row by its worst severity, not its last one', () => {
    const cell = report.getWorksheet('Key')!.getRow(2).getCell(1)
    expect(cell.fill).toEqual(SEVERITY_FILL.critical)
  })

  it('colours a danger row orange', () => {
    const cell = report.getWorksheet('Key')!.getRow(3).getCell(1)
    expect(cell.fill).toEqual(SEVERITY_FILL.danger)
  })

  it('leaves a clean row and a clean sheet uncoloured', () => {
    expect(report.getWorksheet('Key')!.getRow(1).getCell(1).fill).toBeUndefined()
    expect(report.getWorksheet('Giảm phần trăm')!.getRow(2).getCell(1).fill).toBeUndefined()
  })

  it('freezes the header and turns on the filter on an annotated sheet', () => {
    const sheet = report.getWorksheet('Key')!
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
    expect(sheet.autoFilter).toBeTruthy()
  })

  it('hands back a sheet with no findings exactly as it arrived', () => {
    // An instructions or notes tab must not come back carrying filter arrows,
    // two new columns and someone else's freeze pane.
    const sheet = report.getWorksheet('Giảm phần trăm')!
    expect(sheet.getRow(1).getCell(3).value).toBeNull()
    expect(sheet.autoFilter).toBeFalsy()
  })

  it('states the totals and the per-rule counts on the summary sheet', () => {
    const text = sheetText(report.getWorksheet(SUMMARY_SHEET_NAME)!)
    expect(text).toContain('promotion.t8.xlsx')
    expect(text).toContain('Thống kê theo mã luật')
    expect(text).toContain('C2')
    expect(text).toContain('Số tiền giảm bằng 0 hoặc âm') // rule title, looked up from the catalog
  })

  it('lists the findings that point at no row, which nothing else would show', () => {
    const text = sheetText(report.getWorksheet(SUMMARY_SHEET_NAME)!)
    expect(text).toContain('Sheet "Ghi chú" thiếu cột bắt buộc.')
  })
})

function sheetText(sheet: ExcelJS.Worksheet): string {
  const lines: string[] = []
  sheet.eachRow((row) => {
    lines.push(
      (row.values as unknown[])
        .map((value) => (value == null ? '' : String(value)))
        .join(' | '),
    )
  })
  return lines.join('\n')
}
