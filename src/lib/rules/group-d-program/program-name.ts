/**
 * Reads the house naming convention out of a program name.
 *
 * Measured on `promotion.t8.xlsx` (2026-08-18): every one of the 156 program
 * names has the shape `YYMM` + `GST`/`GPT` + value, i.e. `2608GST130K` (August
 * 2026, 130.000đ off) and `2510GPT50%` (October 2025, 50% off). Both parts are
 * cross-checked - the value by D1, the month by D2.
 *
 * Anything that does not fit returns nulls, and both rules then stay silent.
 * That is why they ship disabled by default: the convention is a house habit,
 * not a guarantee.
 */

export type ProgramNameParts = {
  /** Four-digit year read from the `YYMM` prefix. */
  year: number | null
  /** 1-12. */
  month: number | null
  /** Discount amount in đồng, from a trailing `130K`. */
  amount: number | null
  /** Decimal fraction, from a trailing `50%` -> 0.5. */
  percent: number | null
}

const YEAR_MONTH = /^(\d{2})(\d{2})/
const TRAILING_THOUSANDS = /(\d+)\s*K$/i
const TRAILING_PERCENT = /(\d+(?:[.,]\d+)?)\s*%$/

/** `YY` is a two-digit year in this century; the files never reach back before 2000. */
const CENTURY = 2000

export function parseProgramName(name: string): ProgramNameParts {
  const trimmed = name.trim()
  const parts: ProgramNameParts = { year: null, month: null, amount: null, percent: null }

  const yearMonth = YEAR_MONTH.exec(trimmed)
  if (yearMonth) {
    const month = Number(yearMonth[2])
    if (month >= 1 && month <= 12) {
      parts.year = CENTURY + Number(yearMonth[1])
      parts.month = month
    }
  }

  const thousands = TRAILING_THOUSANDS.exec(trimmed)
  if (thousands) parts.amount = Number(thousands[1]) * 1000

  const percent = TRAILING_PERCENT.exec(trimmed)
  if (percent) parts.percent = Number(percent[1].replace(',', '.')) / 100

  return parts
}
