/**
 * Money comparison and formatting.
 *
 * Every amount in the file arrives through `parseNumber`, so a price can carry
 * a floating-point tail (289000.00000000006). Comparing those with `===` would
 * report a perfectly correct file as broken, which is the fastest way to lose
 * the user's trust. All comparisons go through `moneyEquals` with a tolerance
 * that comes from AppSetting, never from a literal at the call site.
 */

/** True when two amounts are the same money, within the configured tolerance. */
export function moneyEquals(a: number, b: number, toleranceVnd: number): boolean {
  return Math.abs(a - b) <= toleranceVnd
}

/** Vietnamese thousands separator, written by hand so it never depends on ICU data. */
export function formatVnd(value: number): string {
  const rounded = Math.round(value)
  const sign = rounded < 0 ? '-' : ''
  const digits = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}${digits}đ`
}

/** 0.5 -> "50%". Input is always the decimal fraction stored in the file. */
export function formatPercent(fraction: number): string {
  const percent = fraction * 100
  const rounded = Math.round(percent * 100) / 100
  return `${rounded}%`
}

/** Discount share of the list price as a decimal fraction; null when meaningless. */
export function discountFraction(listPrice: number | null, amount: number | null): number | null {
  if (listPrice == null || amount == null || listPrice <= 0) return null
  return amount / listPrice
}
