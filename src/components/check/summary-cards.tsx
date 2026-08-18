/**
 * The verdict, before any table.
 *
 * The whole tool exists to answer one question - "can I import this file?" - so
 * that sentence is the largest thing on the page and everything else is the
 * evidence for it.
 *
 * The four branches and their exact wording are the contract with the user; the
 * icon and the colour are added on top so the answer survives being read from
 * across a desk, and neither of them is ever the only signal.
 */

import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SEVERITY_META } from './severity-badge'
import type { CheckRunSummary } from '@/lib/check/finding-queries'

type Verdict = { headline: string; detail: string; className: string; icon: LucideIcon }

function verdict(run: CheckRunSummary): Verdict {
  if (run.countCritical > 0) {
    return {
      headline: 'Chưa import được',
      detail: `${run.countCritical.toLocaleString('vi-VN')} lỗi chắc chắn khiến Haravan từ chối. Sửa hết rồi kiểm tra lại.`,
      className:
        'border-red-300 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-50',
      icon: XCircle,
    }
  }
  if (run.countDanger > 0) {
    return {
      headline: 'Import được, nhưng nên xem lại trước',
      detail: `${run.countDanger.toLocaleString('vi-VN')} chỗ tạo được trên Haravan nhưng kết quả kinh doanh có thể sai.`,
      className:
        'border-orange-300 bg-orange-50 text-orange-950 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-50',
      icon: AlertTriangle,
    }
  }
  if (run.countWarn > 0) {
    return {
      headline: 'Import được',
      detail: `Chỉ còn ${run.countWarn.toLocaleString('vi-VN')} điểm nên ngó qua cho chắc.`,
      className:
        'border-yellow-300 bg-yellow-50 text-yellow-950 dark:border-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-50',
      icon: Info,
    }
  }
  return {
    headline: 'Import được',
    detail: 'Không phát hiện vấn đề nào trong file này.',
    className:
      'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
    icon: CheckCircle2,
  }
}

const NUMBER = new Intl.NumberFormat('vi-VN')

export function SummaryCards({ run }: { run: CheckRunSummary }) {
  const { headline, detail, className, icon: Icon } = verdict(run)
  const counts = [
    { severity: 'critical', value: run.countCritical },
    { severity: 'danger', value: run.countDanger },
    { severity: 'warn', value: run.countWarn },
  ] as const

  return (
    <section className="flex flex-col gap-4">
      <div className={`flex items-start gap-4 rounded-xl border p-5 ${className}`}>
        <Icon aria-hidden className="mt-0.5 size-8 shrink-0" />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-balance">{headline}</h2>
          <p className="text-sm text-pretty opacity-90">{detail}</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{run.fileName}</span> ·{' '}
        {NUMBER.format(run.totalRows)} dòng · {NUMBER.format(run.totalPrograms)} chương trình ·{' '}
        {NUMBER.format(run.totalSheets)} sheet
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {counts.map(({ severity, value }) => {
          const meta = SEVERITY_META[severity]
          return (
            <div
              key={severity}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 ${meta.className}`}
            >
              <span aria-hidden className="text-xl">
                {meta.dot}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="text-3xl leading-none font-semibold tabular-nums">
                  {NUMBER.format(value)}
                </span>
                <span className="pt-1 text-xs">{meta.label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
