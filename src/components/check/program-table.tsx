/**
 * Programs, heaviest first, expanded one at a time.
 *
 * 3.929 rows across 154 programs is unusable as a flat list, and the unit the
 * user actually fixes is the program: one program is one promotion on Haravan,
 * so one broken row makes the whole thing worth looking at.
 *
 * Expansion is a link, not browser state. The expanded program's findings are
 * fetched on the server for that program only - opening one never loads the
 * other 153.
 */

import Link from 'next/link'
import { Check } from 'lucide-react'
import { filterHref, type FindingFilter } from '@/lib/check/finding-filter'
import { cn } from '@/lib/utils'
import { loadProgramFindings, type ProgramSummary } from '@/lib/check/finding-queries'
import { FindingList } from './finding-row'
import { SeverityCount } from './severity-badge'

const NUMBER = new Intl.NumberFormat('vi-VN')

/** One program cannot flood the page; the paginated table below is for going deeper. */
const EXPANDED_LIMIT = 50

function totalFindings(program: ProgramSummary): number {
  return program.countCritical + program.countDanger + program.countWarn
}

async function ExpandedProgram({ runId, programName }: { runId: string; programName: string }) {
  const findings = await loadProgramFindings(runId, programName, EXPANDED_LIMIT)
  return (
    <div className="border-t bg-muted/30 px-4 py-2">
      <FindingList findings={findings} />
      {findings.length === EXPANDED_LIMIT ? (
        <p className="py-2 text-xs text-muted-foreground">
          Chỉ hiện {EXPANDED_LIMIT} phát hiện đầu. Dùng bảng chi tiết bên dưới để xem hết.
        </p>
      ) : null}
    </div>
  )
}

export function ProgramTable({
  runId,
  basePath,
  programs,
  filter,
}: {
  runId: string
  basePath: string
  programs: readonly ProgramSummary[]
  filter: FindingFilter
}) {
  if (programs.length === 0) {
    return <p className="text-sm text-muted-foreground">File không có chương trình nào đọc được.</p>
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      {programs.map((program) => {
        const expanded = filter.expandedProgram === program.name
        const total = totalFindings(program)
        const href = filterHref(basePath, filter, {
          expandedProgram: expanded ? null : program.name,
        })

        return (
          <div key={program.name} className="border-b last:border-b-0">
            <Link
              href={href}
              scroll={false}
              aria-expanded={expanded}
              className={cn(
                'flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-sm hover:bg-muted/50',
                // A clean program is not news. Fading it is what lets a screen
                // of 154 programs read as "these six need me" at a glance.
                total === 0 && 'text-muted-foreground',
              )}
            >
              <span aria-hidden className="w-3 text-muted-foreground">
                {expanded ? '▾' : '▸'}
              </span>
              <span className={cn('min-w-40 flex-1', total > 0 && 'font-medium')}>
                {program.name}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {NUMBER.format(program.rowCount)} dòng
              </span>
              {total === 0 ? (
                <span className="inline-flex items-center gap-1 text-xs">
                  <Check aria-hidden className="size-3.5 text-emerald-700 dark:text-emerald-400" />
                  không có vấn đề
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <SeverityCount severity="critical" count={program.countCritical} />
                  <SeverityCount severity="danger" count={program.countDanger} />
                  <SeverityCount severity="warn" count={program.countWarn} />
                </span>
              )}
            </Link>

            {expanded && total > 0 ? (
              <ExpandedProgram runId={runId} programName={program.name} />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
