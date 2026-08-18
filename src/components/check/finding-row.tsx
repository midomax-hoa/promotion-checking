/**
 * One finding, rendered the same way wherever it appears - inside an expanded
 * program, in the paginated table, or in the file-level list.
 *
 * The suggestion is part of the finding, not an optional extra: a message that
 * only says what is wrong sends the user back to guessing.
 *
 * Wide screens get two columns rather than one long line. Handing a 1600px
 * screen to a single paragraph produces lines nobody can track back to the
 * start; pinning the metadata to a fixed left column instead spends the width
 * on making the message land in one line.
 */

import type { FindingRecord } from '@/lib/check/finding-queries'
import { SeverityBadge } from './severity-badge'

/** "dòng 15 · KMAP240101.L" - only the parts that exist. */
function locationLabel(finding: FindingRecord): string {
  const parts: string[] = []
  if (finding.rowNumber != null) parts.push(`dòng ${finding.rowNumber}`)
  if (finding.sku) parts.push(finding.sku)
  else if (finding.programName) parts.push(finding.programName)
  return parts.join(' · ')
}

export function FindingItem({
  finding,
  showProgram = false,
}: {
  finding: FindingRecord
  showProgram?: boolean
}) {
  const location = locationLabel(finding)
  return (
    <li className="grid gap-x-5 gap-y-1 border-b py-1.5 last:border-b-0 lg:grid-cols-[21rem_minmax(0,1fr)]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <SeverityBadge severity={finding.severity} />
        <span className="font-mono font-medium text-foreground">{finding.ruleCode}</span>
        {location ? <span>{location}</span> : null}
        {showProgram && finding.programName ? (
          <span className="rounded bg-muted px-1.5 py-0.5">{finding.programName}</span>
        ) : null}
        {finding.sheetName ? <span className="italic">{finding.sheetName}</span> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm text-pretty">{finding.message}</p>
        {finding.suggestion ? (
          <p className="text-sm text-pretty text-muted-foreground">→ {finding.suggestion}</p>
        ) : null}
      </div>
    </li>
  )
}

export function FindingList({
  findings,
  showProgram = false,
}: {
  findings: readonly FindingRecord[]
  showProgram?: boolean
}) {
  if (findings.length === 0) {
    return <p className="py-3 text-sm text-muted-foreground">Không có phát hiện nào khớp bộ lọc.</p>
  }
  return (
    <ul className="flex flex-col">
      {findings.map((finding) => (
        <FindingItem key={finding.id} finding={finding} showProgram={showProgram} />
      ))}
    </ul>
  )
}
