/**
 * Turns one stored comparison into the rows of the three-column table.
 *
 * Recomputed from the snapshot rather than derived from the findings, because
 * the table has to show the fields that *agree* too - a screen that only lists
 * problems cannot answer "did the dates come across right?". The same helpers
 * the rules use do the comparing, so a cell is never marked as differing when
 * the matching rule stayed silent.
 *
 * `differs` is deliberately false whenever a side is unknown. An empty Excel
 * cell is not evidence that Haravan is wrong.
 */

import { moneyEquals } from '@/lib/rules/helpers/money'
import { formatDiscount } from './group-f-reconcile/finding-ref'
import type { ReconcileMatchRecord } from './reconcile-queries'
import { compareTimestamps, formatWallClock } from './shop-time'

export type DiffField = {
  label: string
  excel: string
  haravan: string
  differs: boolean
}

export type DiffOptions = {
  shopTimezoneOffsetMinutes: number
  moneyToleranceVnd: number
  percentTolerance: number
}

const MISSING = '(không có)'

function count(value: number | null, unit: string): string {
  return value == null ? MISSING : `${value} ${unit}`
}

function discountDiffers(row: ReconcileMatchRecord, options: DiffOptions): boolean {
  if (row.excelValue == null || row.haravanValue == null) return false
  if (row.excelDiscountType == null || row.haravanTakeType == null) return false
  if (row.excelDiscountType !== row.haravanTakeType) return true
  return row.haravanTakeType === 'percentage'
    ? Math.abs(row.excelValue - row.haravanValue) > options.percentTolerance
    : !moneyEquals(row.excelValue, row.haravanValue, options.moneyToleranceVnd)
}

function dateField(
  label: string,
  excel: Date | null,
  haravan: Date | null,
  offsetMinutes: number,
): DiffField {
  const comparison = compareTimestamps(excel, haravan, offsetMinutes)
  return {
    label,
    excel: formatWallClock(comparison.excel),
    haravan: formatWallClock(comparison.haravan),
    // Nothing in the file gives no grounds to call Haravan wrong - the same
    // asymmetry rule F3 applies.
    differs: excel != null && !comparison.equal,
  }
}

export function buildDiff(row: ReconcileMatchRecord, options: DiffOptions): DiffField[] {
  const offset = options.shopTimezoneOffsetMinutes

  return [
    {
      label: 'Giá trị giảm',
      excel: formatDiscount(row.excelValue, row.excelDiscountType),
      haravan: formatDiscount(row.haravanValue, row.haravanTakeType),
      differs: discountDiffers(row, options),
    },
    dateField('Ngày bắt đầu', row.excelStartAt, row.haravanStartAt, offset),
    dateField('Ngày kết thúc', row.excelEndAt, row.haravanEndAt, offset),
    {
      label: 'Số mã hiệu',
      excel: count(row.excelSkuCount, 'mã hiệu'),
      haravan:
        row.haravanVariantCount == null
          ? 'chưa tra được'
          : `${row.haravanVariantCount} biến thể${row.haravanByProduct ? ' (đính theo sản phẩm)' : ''}`,
      differs:
        row.excelSkuCount != null &&
        row.excelSkuCount > 0 &&
        row.haravanVariantCount != null &&
        row.excelSkuCount !== row.haravanVariantCount,
    },
    {
      label: 'Trạng thái',
      excel: '—',
      haravan: row.haravanStatus ?? MISSING,
      differs: row.haravanStatus != null && row.haravanStatus.toLowerCase() !== 'enabled',
    },
  ]
}
