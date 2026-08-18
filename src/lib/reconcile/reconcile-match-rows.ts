/**
 * Flattens the match list into rows for the `ReconcileMatch` table.
 *
 * One row per (program, Haravan promotion) pair rather than per program, so a
 * duplicate name writes one row per candidate and the screen can list them all.
 * A program with nothing on Haravan still gets a row, with the Haravan half
 * left null - the three-column table has to be able to show an empty column,
 * not skip the program.
 *
 * Both sides are snapshotted rather than referenced. Months later the promotion
 * may have been edited and the uploaded file pruned, and the report still has
 * to say what the two sides looked like at the moment they were compared.
 */

import type { MatchResult, ReconcilePromotion } from './types'

export type ReconcileMatchRow = {
  programName: string
  status: string
  excelRowCount: number | null
  excelSkuCount: number | null
  excelDiscountType: string | null
  excelValue: number | null
  excelStartAt: Date | null
  excelEndAt: Date | null
  haravanId: string | null
  haravanTakeType: string | null
  haravanValue: number | null
  haravanStartAt: Date | null
  haravanEndAt: Date | null
  haravanStatus: string | null
  haravanVariantCount: number | null
  haravanByProduct: boolean
}

const EMPTY_HARAVAN = {
  haravanId: null,
  haravanTakeType: null,
  haravanValue: null,
  haravanStartAt: null,
  haravanEndAt: null,
  haravanStatus: null,
  haravanVariantCount: null,
  haravanByProduct: false,
} as const

function haravanSide(promotion: ReconcilePromotion) {
  return {
    haravanId: promotion.id,
    haravanTakeType: promotion.takeType,
    haravanValue: promotion.value,
    haravanStartAt: promotion.startAt,
    haravanEndAt: promotion.endAt,
    haravanStatus: promotion.status,
    haravanVariantCount: promotion.attachedVariantCount,
    haravanByProduct: promotion.attachedByProduct,
  }
}

export function buildReconcileMatchRows(matches: readonly MatchResult[]): ReconcileMatchRow[] {
  const rows: ReconcileMatchRow[] = []

  for (const match of matches) {
    const excel = {
      programName: match.programName,
      status: match.status,
      excelRowCount: match.expectation?.rowCount ?? null,
      excelSkuCount: match.expectation?.distinctSkuCount ?? null,
      excelDiscountType: match.expectation?.discountType ?? null,
      excelValue: match.expectation?.value ?? null,
      excelStartAt: match.expectation?.startAt ?? null,
      excelEndAt: match.expectation?.endAt ?? null,
    }

    if (match.haravanMatches.length === 0) {
      rows.push({ ...excel, ...EMPTY_HARAVAN })
      continue
    }
    for (const promotion of match.haravanMatches) {
      rows.push({ ...excel, ...haravanSide(promotion) })
    }
  }

  return rows
}
