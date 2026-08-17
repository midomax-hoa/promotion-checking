import type { HaravanProduct } from './types'

/**
 * Cursor maths for the incremental sync.
 *
 * The cursor feeds `updated_at_min` on the next run, and it is taken from
 * Haravan's own `updated_at` rather than the server clock so a clock skew
 * between this machine and Haravan cannot skip products.
 */

/** Newest `updated_at` in a batch, ignoring anything unparseable. */
export function latestUpdatedAt(batch: HaravanProduct[], current: Date | null): Date | null {
  let latest = current
  for (const product of batch) {
    if (!product.updated_at) continue
    const value = new Date(product.updated_at)
    if (Number.isNaN(value.getTime())) continue
    if (!latest || value > latest) latest = value
  }
  return latest
}

/**
 * Pulls the cursor back by an overlap window.
 *
 * A product edited while the sync had already passed its page keeps an
 * `updated_at` below the new cursor and would never be fetched again. Rewinding
 * costs a few re-fetched products, and the writes are idempotent.
 */
export function rewindCursor(value: Date | null, overlapMs: number): Date | null {
  if (!value) return null
  return new Date(value.getTime() - overlapMs)
}
