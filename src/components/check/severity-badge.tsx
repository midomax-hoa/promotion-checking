/**
 * One severity, always shown the same way: colour, dot and Vietnamese wording
 * together. Colour alone would be unreadable for a colour-blind user, and the
 * dot alone means nothing to someone seeing the tool for the first time.
 */

import { cn } from '@/lib/utils'

export const SEVERITY_META = {
  critical: {
    dot: '🔴',
    label: 'Chắc chắn thất bại',
    short: 'Thất bại',
    className: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100',
  },
  danger: {
    dot: '🟠',
    label: 'Tạo được nhưng nguy hiểm',
    short: 'Nguy hiểm',
    className: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-100',
  },
  warn: {
    dot: '🟡',
    label: 'Nên xem lại',
    short: 'Xem lại',
    className: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100',
  },
} as const

export type SeverityKey = keyof typeof SEVERITY_META

export const SEVERITY_ORDER: readonly SeverityKey[] = ['critical', 'danger', 'warn']

export function isSeverityKey(value: string): value is SeverityKey {
  return value in SEVERITY_META
}

export function SeverityBadge({
  severity,
  count,
  variant = 'short',
  className,
}: {
  severity: string
  /** Omitted renders the label on its own, e.g. next to a single finding. */
  count?: number
  variant?: 'short' | 'long'
  className?: string
}) {
  if (!isSeverityKey(severity)) {
    return <span className={cn('text-xs text-muted-foreground', className)}>{severity}</span>
  }
  const meta = SEVERITY_META[severity]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        meta.className,
        className,
      )}
      title={meta.label}
    >
      <span aria-hidden>{meta.dot}</span>
      {count === undefined ? null : <span className="tabular-nums">{count}</span>}
      <span>{variant === 'long' ? meta.label : meta.short}</span>
    </span>
  )
}

/** Compact counter used inside the program table, where three of them sit side by side. */
export function SeverityCount({ severity, count }: { severity: SeverityKey; count: number }) {
  const meta = SEVERITY_META[severity]
  return (
    <span
      className={cn(
        'inline-flex min-w-12 items-center justify-center gap-1 rounded-md px-1.5 py-0.5 text-xs tabular-nums',
        count === 0 ? 'text-muted-foreground' : meta.className,
      )}
      title={`${meta.label}: ${count}`}
    >
      <span aria-hidden>{meta.dot}</span>
      {count}
    </span>
  )
}
