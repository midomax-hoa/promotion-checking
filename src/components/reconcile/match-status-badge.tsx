/**
 * The four outcomes of lining a program up against Haravan, each with its own
 * wording rather than a colour alone - "ambiguous" in particular has to say why
 * the tool stopped instead of looking like a failure.
 */

import { cn } from '@/lib/utils'

export const MATCH_STATUS_META = {
  matched: {
    label: 'Đã khớp',
    hint: 'Tìm thấy đúng một chương trình cùng tên trên Haravan',
    className: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  },
  'not-found': {
    label: 'Không thấy trên Haravan',
    hint: 'Cả hai lượt kiểm đều không tìm ra chương trình này',
    className: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100',
  },
  ambiguous: {
    label: 'Trùng tên',
    hint: 'Haravan có nhiều chương trình cùng tên nên không tự chọn được cái nào',
    className: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-100',
  },
  'extra-on-haravan': {
    label: 'Chỉ có trên Haravan',
    hint: 'Haravan đang chạy chương trình này nhưng file không có',
    className: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100',
  },
} as const

export type MatchStatusKey = keyof typeof MATCH_STATUS_META

export function isMatchStatusKey(value: string): value is MatchStatusKey {
  return value in MATCH_STATUS_META
}

export function MatchStatusBadge({ status, className }: { status: string; className?: string }) {
  if (!isMatchStatusKey(status)) {
    return <span className={cn('text-xs text-muted-foreground', className)}>{status}</span>
  }
  const meta = MATCH_STATUS_META[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        meta.className,
        className,
      )}
      title={meta.hint}
    >
      {meta.label}
    </span>
  )
}
