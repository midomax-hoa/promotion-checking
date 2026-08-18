/**
 * The `Tổng hợp` sheet: the answer to "can this file be imported?" on one page.
 *
 * Split out of `report-exporter.ts` because that file's job is annotating the
 * user's own sheets, and this one is the only place that writes new content.
 */

import type { Workbook, Worksheet } from 'exceljs'
import { SYSTEM_FINDING_TITLES, findRuleDefinition } from '@/lib/rules/rule-catalog'
import { SEVERITY_FILL, SEVERITY_LABEL, worstSeverity, type ReportFinding } from './report-styles'

export const SUMMARY_SHEET_NAME = 'Tổng hợp'

/**
 * ExcelJS throws on a duplicate sheet name, and `Tổng hợp` is an ordinary tab
 * name for a Vietnamese workbook to already have. Without this, such a file
 * would check fine and then fail to export for ever.
 */
function freeSheetName(workbook: Workbook): string {
  if (workbook.getWorksheet(SUMMARY_SHEET_NAME) == null) return SUMMARY_SHEET_NAME
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${SUMMARY_SHEET_NAME} (báo cáo ${suffix})`
    if (workbook.getWorksheet(candidate) == null) return candidate
  }
}

export type ReportRunInfo = {
  fileName: string
  createdAt: Date
  totalSheets: number
  totalRows: number
  totalPrograms: number
  countCritical: number
  countDanger: number
  countWarn: number
}

function ruleTitle(code: string): string {
  return findRuleDefinition(code)?.title ?? SYSTEM_FINDING_TITLES[code] ?? code
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(value)
}

function addTitle(sheet: Worksheet, text: string): void {
  const row = sheet.addRow([text])
  row.getCell(1).font = { bold: true, size: 12 }
}

/** rule code -> how many findings carried it, worst severity first. */
function countByRule(findings: readonly ReportFinding[]) {
  const counts = new Map<string, { count: number; severity: string }>()
  for (const finding of findings) {
    const current = counts.get(finding.ruleCode)
    counts.set(finding.ruleCode, {
      count: (current?.count ?? 0) + 1,
      severity: worstSeverity([current?.severity, finding.severity]),
    })
  }
  return [...counts.entries()]
    .map(([code, value]) => ({ code, ...value }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
}

export function addSummarySheet(
  workbook: Workbook,
  run: ReportRunInfo,
  findings: readonly ReportFinding[],
): Worksheet {
  const sheet = workbook.addWorksheet(freeSheetName(workbook))
  sheet.columns = [{ width: 14 }, { width: 62 }, { width: 16 }, { width: 12 }]

  addTitle(sheet, `Kết quả kiểm tra: ${run.fileName}`)
  sheet.addRow([`Thời điểm kiểm tra`, formatDateTime(run.createdAt)])
  sheet.addRow(['Số sheet', run.totalSheets])
  sheet.addRow(['Số dòng', run.totalRows])
  sheet.addRow(['Số chương trình', run.totalPrograms])
  sheet.addRow([])

  addTitle(sheet, 'Số phát hiện theo mức')
  for (const [severity, count] of [
    ['critical', run.countCritical],
    ['danger', run.countDanger],
    ['warn', run.countWarn],
  ] as const) {
    const row = sheet.addRow([SEVERITY_LABEL[severity], count])
    row.getCell(1).fill = SEVERITY_FILL[severity]
  }
  sheet.addRow([])

  addTitle(sheet, 'Thống kê theo mã luật')
  const header = sheet.addRow(['Mã luật', 'Nội dung luật', 'Mức', 'Số phát hiện'])
  header.font = { bold: true }
  for (const entry of countByRule(findings)) {
    const row = sheet.addRow([
      entry.code,
      ruleTitle(entry.code),
      SEVERITY_LABEL[entry.severity as keyof typeof SEVERITY_LABEL] ?? entry.severity,
      entry.count,
    ])
    const fill = SEVERITY_FILL[entry.severity as keyof typeof SEVERITY_FILL]
    if (fill) row.getCell(3).fill = fill
  }

  // Findings that point at no row cannot be coloured in place, so they would
  // vanish from the report entirely if they were not listed here.
  const unplaced = findings.filter((finding) => finding.rowNumber == null)
  if (unplaced.length > 0) {
    sheet.addRow([])
    addTitle(sheet, 'Cảnh báo không gắn với một dòng cụ thể')
    for (const finding of unplaced) {
      const row = sheet.addRow([
        finding.ruleCode,
        finding.message,
        SEVERITY_LABEL[finding.severity as keyof typeof SEVERITY_LABEL] ?? finding.severity,
        finding.programName ?? '',
      ])
      row.getCell(2).alignment = { wrapText: true, vertical: 'top' }
    }
  }

  return sheet
}
