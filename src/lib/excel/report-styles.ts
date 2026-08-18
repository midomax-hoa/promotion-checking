/**
 * Colours and severity ordering shared by the report writer.
 *
 * Pale fills on purpose: the exported file is meant to be read and edited by
 * the person who built it, and a saturated background makes the black text in
 * the original cells hard to read.
 */

import type { Fill } from 'exceljs'
import type { Severity } from '@/lib/rules/types'

export type ReportFinding = {
  severity: string
  sheetName: string | null
  rowNumber: number | null
  programName: string | null
  ruleCode: string
  message: string
  suggestion: string | null
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, danger: 1, warn: 2 }

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Chắc chắn thất bại',
  danger: 'Tạo được nhưng nguy hiểm',
  warn: 'Nên xem lại',
}

const solid = (argb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })

export const SEVERITY_FILL: Record<Severity, Fill> = {
  critical: solid('FFFFC7CE'), // pale red
  danger: solid('FFFFE0B2'), // pale orange
  warn: solid('FFFFF2CC'), // pale yellow
}

function rank(severity: string | undefined): number {
  return severity != null && severity in SEVERITY_RANK
    ? SEVERITY_RANK[severity as Severity]
    : Number.MAX_SAFE_INTEGER
}

/**
 * The heaviest severity present. A row carrying both a `warn` and a `critical`
 * has to look critical - colouring it yellow would hide the blocking problem.
 */
export function worstSeverity(severities: readonly (string | undefined)[]): string {
  let best: string | undefined
  for (const severity of severities) {
    if (rank(severity) < rank(best)) best = severity
  }
  // No fallback to 'warn': an unrecognised severity would then be painted the
  // mildest colour, understating a problem nobody has classified yet. The
  // caller looks the value up in SEVERITY_FILL and simply leaves it unfilled.
  return best ?? severities.find((value) => value != null) ?? 'unknown'
}
