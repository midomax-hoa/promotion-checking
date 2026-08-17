/**
 * One SKU normalisation rule for the whole codebase.
 *
 * Haravan allows `sku: null` and duplicate SKUs across variants, and the Excel
 * files carry stray spaces and mixed casing. Every lookup key goes through
 * `normalizeSku`; the original text is kept separately for display.
 *
 * A blank SKU normalises to `null` on purpose: `GET /com/products.json?sku=`
 * with an empty value returns 50 arbitrary products, which would silently bind
 * a promotion row to the wrong product.
 */

/** Lookup key: trimmed and lower-cased, or null when there is nothing left. */
export function normalizeSku(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  return trimmed.length === 0 ? null : trimmed.toLowerCase()
}

/** Text shown to the user: trimmed but case preserved, or null when blank. */
export function displaySku(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  return trimmed.length === 0 ? null : trimmed
}

/** True when the value cannot be used as a lookup key. */
export function isBlankSku(raw: string | null | undefined): boolean {
  return normalizeSku(raw) === null
}
