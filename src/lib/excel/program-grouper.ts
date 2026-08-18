/**
 * Groups rows by `Tên ctkm` and collects, per program, the distinct values of
 * every field Haravan allows only one of.
 *
 * That is the whole reason this step exists. Haravan creates one promotion per
 * program name with a single discount, window and usage limit; a file that
 * gives the same program two different end dates describes something that
 * cannot be created. Rules D1-D5 read these arrays and report any with more
 * than one entry.
 *
 * Rows are grouped across sheets on purpose: the sample file splits one
 * campaign over "Key" and "Giảm phần trăm", and a conflict between the two
 * sheets is exactly the kind of thing that slips through a manual check.
 */

import { UNNAMED_PROGRAM, type PromotionProgram, type PromotionRow } from './types'

/** Dates compare by identity, so distinctness is measured on the epoch value. */
function distinctDates(values: (Date | null)[]): (Date | null)[] {
  const seen = new Set<number | null>()
  const result: (Date | null)[] = []
  for (const value of values) {
    const key = value == null ? null : value.getTime()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

function distinct<T>(values: T[]): T[] {
  return [...new Set(values)]
}

/** Blank names all land in one bucket rather than vanishing from the report. */
export function programKey(row: PromotionRow): string {
  const name = row.programName?.trim()
  return name == null || name.length === 0 ? UNNAMED_PROGRAM : name
}

export function groupPrograms(rows: readonly PromotionRow[]): PromotionProgram[] {
  const buckets = new Map<string, PromotionRow[]>()

  for (const row of rows) {
    const key = programKey(row)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(row)
    else buckets.set(key, [row])
  }

  // Map preserves insertion order, so programs come out in the order they first
  // appear in the file - the order the user scrolls through.
  return [...buckets].map(([name, programRows]) => ({
    name,
    rows: programRows,
    sheetNames: distinct(programRows.map((row) => row.sheetName)),
    // Unknown types are dropped here; rule C6 already flags them per row.
    distinctDiscountTypes: distinct(
      programRows.map((row) => row.discountType).filter((type) => type != null),
    ),
    distinctAmounts: distinct(programRows.map((row) => row.discountAmount)),
    distinctPercents: distinct(programRows.map((row) => row.discountPercent)),
    distinctStarts: distinctDates(programRows.map((row) => row.startAt)),
    distinctEnds: distinctDates(programRows.map((row) => row.endAt)),
    distinctUsageLimits: distinct(programRows.map((row) => row.usageLimit)),
  }))
}
