/**
 * Turns money and quantity cells into numbers.
 *
 * The distinction that matters: a blank cell is `{ ok: true, value: null }`,
 * garbage is `{ ok: false }`. Collapsing the two into `0` would turn an empty
 * `Số tiền giảm` into a 0đ discount - exactly the defect this tool exists to
 * catch (279 such rows in the sample file).
 */

import { unwrapCell } from './cell-value'

export type NumberParseResult =
  | { ok: true; value: number | null }
  | { ok: false; raw: unknown }

const BLANK: NumberParseResult = { ok: true, value: null }

/**
 * Noise people paste in from other systems: thousands separators and the stray
 * quotes some locales use as separators. `\s` already covers the non-breaking
 * spaces that arrive with numbers copied out of a web page.
 */
const NOISE = /[\s,'"]/g

/** Rejects hex (`0x10`), exponents and trailing junk that `Number()` would accept. */
const PLAIN_NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)$/

export function parseNumber(raw: unknown): NumberParseResult {
  const value = unwrapCell(raw)
  if (value == null) return BLANK

  if (typeof value === 'number') {
    return Number.isFinite(value) ? { ok: true, value } : { ok: false, raw }
  }

  // A boolean is never a legitimate amount; reading true as 1 would invent data.
  if (typeof value === 'boolean' || value instanceof Date) return { ok: false, raw }

  const cleaned = value.replace(NOISE, '')
  if (cleaned.length === 0) return BLANK
  if (!PLAIN_NUMBER.test(cleaned)) return { ok: false, raw }

  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? { ok: true, value: parsed } : { ok: false, raw }
}
