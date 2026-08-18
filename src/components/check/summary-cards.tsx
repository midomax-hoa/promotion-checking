/**
 * The verdict, before any table.
 *
 * The whole tool exists to answer one question - "can I import this file?" - so
 * that sentence is the largest thing on the page and everything else is the
 * evidence for it.
 */

import { SEVERITY_META } from './severity-badge'
import type { CheckRunSummary } from '@/lib/check/finding-queries'

function verdict(run: CheckRunSummary): { headline: string; detail: string; className: string } {
  if (run.countCritical > 0) {
    return {
      headline: 'Chưa import được',
      detail: `${run.countCritical.toLocaleString('vi-VN')} lỗi chắc chắn khiến Haravan từ chối. Sửa hết rồi kiểm tra lại.`,
      className: 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40',
    }
  }
  if (run.countDanger > 0) {
    return {
      headline: 'Import được, nhưng nên xem lại trước',
      detail: `${run.countDanger.toLocaleString('vi-VN')} chỗ tạo được trên Haravan nhưng kết quả kinh doanh có thể sai.`,
      className: 'border-orange-300 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/40',
    }
  }
  if (run.countWarn > 0) {
    return {
      headline: 'Import được',
      detail: `Chỉ còn ${run.countWarn.toLocaleString('vi-VN')} điểm nên ngó qua cho chắc.`,
      className: 'border-yellow-300 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/40',
    }
  }
  return {
    headline: 'Import được',
    detail: 'Không phát hiện vấn đề nào trong file này.',
    className: 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40',
  }
}

const NUMBER = new Intl.NumberFormat('vi-VN')

export function SummaryCards({ run }: { run: CheckRunSummary }) {
  const { headline, detail, className } = verdict(run)
  const counts = [
    { severity: 'critical', value: run.countCritical },
    { severity: 'danger', value: run.countDanger },
    { severity: 'warn', value: run.countWarn },
  ] as const

  return (
    <section className="flex flex-col gap-4">
      <div className={`flex flex-col gap-1 rounded-lg border p-4 ${className}`}>
        <h2 className="text-2xl font-semibold">{headline}</h2>
        <p className="text-sm">{detail}</p>
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
            <div key={severity} className={`flex flex-col gap-1 rounded-lg p-3 ${meta.className}`}>
              <span className="text-2xl font-semibold tabular-nums">
                <span aria-hidden className="mr-2 text-lg">
                  {meta.dot}
                </span>
                {NUMBER.format(value)}
              </span>
              <span className="text-xs">{meta.label}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
