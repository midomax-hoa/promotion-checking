/**
 * Shared bits for the per-program rules.
 *
 * Group D judges a whole program at once - Haravan creates one promotion per
 * `Tên ctkm`, so reporting the same wrong end date on 279 rows would bury the
 * report. Each finding still points at the program's first row so the user can
 * jump into the file.
 */

import type { PromotionProgram, PromotionRow } from '@/lib/excel/types'
import { formatDate, type DateWindow } from '../helpers/date-range'
import type { RuleFinding } from '../types'

export function programRef(
  program: PromotionProgram,
): Pick<RuleFinding, 'sheetName' | 'rowNumber' | 'programName'> {
  const first: PromotionRow | undefined = program.rows[0]
  return {
    programName: program.name,
    sheetName: first?.sheetName,
    rowNumber: first?.rowNumber,
  }
}

export type ProgramWindow = DateWindow & { rowCount: number }

/**
 * The distinct start/end pairs a program uses. Normally one; more than one
 * means the file describes a program Haravan cannot create, which D3 reports -
 * the date rules then judge each pair on its own rather than picking a winner.
 */
export function programWindows(program: PromotionProgram): ProgramWindow[] {
  const byKey = new Map<string, ProgramWindow>()

  for (const row of program.rows) {
    const key = `${row.startAt?.getTime() ?? 'x'}|${row.endAt?.getTime() ?? 'x'}`
    const existing = byKey.get(key)
    if (existing) existing.rowCount += 1
    else byKey.set(key, { start: row.startAt, end: row.endAt, rowCount: 1 })
  }

  return [...byKey.values()]
}

/** "01/08/2026" or, when a program holds several windows, "01/08/2026 (106 dòng)". */
export function describeWindowRows(window: ProgramWindow, totalWindows: number): string {
  return totalWindows > 1 ? ` (${window.rowCount} dòng)` : ''
}

export { formatDate }
