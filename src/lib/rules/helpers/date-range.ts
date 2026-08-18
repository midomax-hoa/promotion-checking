/**
 * Date window helpers.
 *
 * Promotions are compared by calendar day, not by instant: a program starting
 * today at 00:00 has not "already started" in any sense the user cares about,
 * and the file only ever carries whole days anyway (verified on the sample
 * file - every cell is a midnight-local Date).
 *
 * A `null` end date means open-ended, so it overlaps everything after its start.
 */

const MS_PER_DAY = 86_400_000

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Whole days from `from` to `to`; negative when the window runs backwards. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY)
}

export type DateWindow = { start: Date | null; end: Date | null }

/**
 * Inclusive overlap on whole days. Two programs that meet on one day do overlap
 * - Haravan would have both active that day, which is exactly what E1 reports.
 */
export function windowsOverlap(a: DateWindow, b: DateWindow): boolean {
  const aStart = a.start ? startOfDay(a.start).getTime() : -Infinity
  const aEnd = a.end ? startOfDay(a.end).getTime() : Infinity
  const bStart = b.start ? startOfDay(b.start).getTime() : -Infinity
  const bEnd = b.end ? startOfDay(b.end).getTime() : Infinity
  return aStart <= bEnd && bStart <= aEnd
}

/** dd/MM/yyyy - the format the file itself uses. */
export function formatDate(date: Date | null): string {
  if (date == null) return '(không có)'
  const day = `${date.getDate()}`.padStart(2, '0')
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  return `${day}/${month}/${date.getFullYear()}`
}

export function formatWindow(window: DateWindow): string {
  return `${formatDate(window.start)} - ${formatDate(window.end)}`
}
