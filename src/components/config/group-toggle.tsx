'use client'

/**
 * Whole-group switches.
 *
 * Plain submit buttons rather than client state: they carry an intent along with
 * the rest of the form, so pending edits elsewhere in the table survive the click
 * instead of being silently dropped.
 */

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function GroupToggle({
  groupCode,
  enabledCount,
  total,
  pending,
}: {
  groupCode: string
  enabledCount: number
  total: number
  pending: boolean
}) {
  const style = cn(buttonVariants({ variant: 'ghost', size: 'xs' }))
  return (
    <span className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground tabular-nums">
        {enabledCount}/{total} đang bật
      </span>
      <button
        type="submit"
        name="intent"
        value={`group-on:${groupCode}`}
        className={style}
        disabled={pending || enabledCount === total}
      >
        Bật cả nhóm
      </button>
      <button
        type="submit"
        name="intent"
        value={`group-off:${groupCode}`}
        className={style}
        disabled={pending || enabledCount === 0}
      >
        Tắt cả nhóm
      </button>
    </span>
  )
}
