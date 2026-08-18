/**
 * The answer to "did my import land correctly", one program per block.
 *
 * Three columns - what the file said, what Haravan holds, what the difference
 * is - and the difference column stays empty when there is none. A row that
 * agrees is still shown, because "the dates are right" is information the user
 * came here for just as much as "the discount is wrong".
 *
 * Differing cells are marked with a colour *and* a word. Colour alone would be
 * unreadable for a colour-blind user, which on this screen means missing the one
 * thing they came to see.
 */

import { buildDiff, type DiffOptions } from '@/lib/reconcile/match-diff'
import type { ReconcileMatchRecord } from '@/lib/reconcile/reconcile-queries'
import { cn } from '@/lib/utils'
import { MatchStatusBadge } from './match-status-badge'

const NUMBER = new Intl.NumberFormat('vi-VN')

function MatchBlock({ row, options }: { row: ReconcileMatchRecord; options: DiffOptions }) {
  const fields = buildDiff(row, options)
  const differing = fields.filter((field) => field.differs).length

  return (
    <section className="flex flex-col gap-2 border-b p-4 last:border-b-0">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 text-sm font-semibold">{row.programName}</h3>
        <MatchStatusBadge status={row.status} />
        {row.excelRowCount != null ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {NUMBER.format(row.excelRowCount)} dòng trong file
          </span>
        ) : null}
        {row.haravanId ? (
          <span className="font-mono text-xs text-muted-foreground">#{row.haravanId}</span>
        ) : null}
      </header>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="w-32 py-1 font-medium">Mục</th>
            <th className="py-1 font-medium">Trong file Excel</th>
            <th className="py-1 font-medium">Trên Haravan</th>
            <th className="w-40 py-1 font-medium">Chênh lệch</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.label} className="border-t">
              <td className="py-1.5 pr-2 text-muted-foreground">{field.label}</td>
              <td className="py-1.5 pr-2">{field.excel}</td>
              <td
                className={cn(
                  'py-1.5 pr-2',
                  field.differs && 'font-semibold text-red-700 dark:text-red-300',
                )}
              >
                {field.haravan}
              </td>
              <td className="py-1.5 text-xs">
                {field.differs ? (
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-900 dark:bg-red-950 dark:text-red-100">
                    lệch
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {row.status === 'not-found' ? (
        <p className="text-xs text-muted-foreground">
          Không tìm thấy chương trình nào cùng tên trên Haravan, nên cột bên phải để trống.
        </p>
      ) : null}
      {differing === 0 && row.status === 'matched' ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">Khớp hoàn toàn.</p>
      ) : null}
    </section>
  )
}

export function DiffTable({
  rows,
  options,
}: {
  rows: readonly ReconcileMatchRecord[]
  options: DiffOptions
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
        Lần chạy này không có chương trình nào để đối chiếu.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      {rows.map((row) => (
        <MatchBlock key={row.id} row={row} options={options} />
      ))}
    </div>
  )
}
