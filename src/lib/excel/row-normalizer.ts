/**
 * Turns one raw spreadsheet row into a `PromotionRow`.
 *
 * Every failure is recorded, never thrown and never patched over: a cell that
 * cannot be read leaves its field `null` and adds an entry to `issues`, which
 * the rule engine turns into a message naming the exact Excel row.
 */

import { normalizeSku } from '@/lib/catalog/sku'
import { cellText, isBlankCell } from './cell-value'
import type { ColumnField, ColumnMapping } from './column-mapper'
import { parseExcelDate } from './date-parser'
import { parseNumber } from './number-parser'
import type { CellIssue, DiscountType, PromotionRow } from './types'
import type { RawRow } from './excel-reader'

/**
 * Matched against the lower-cased `Kiểu ctkm`. Substrings, because the real file
 * writes "Giảm giá theo số tiền" and "Giảm giá theo phần trăm". `phần trăm` is
 * tested before `số tiền`: a row reading "giảm theo phần trăm, không theo số
 * tiền" is a percentage promotion.
 */
const DISCOUNT_TYPES: readonly (readonly [string, DiscountType])[] = [
  ['phần trăm', 'percentage'],
  ['số tiền', 'fixed_amount'],
  ['đồng giá', 'same_price'],
]

export function parseDiscountType(raw: string | null): DiscountType | null {
  if (raw == null) return null
  const text = raw.toLowerCase()
  return DISCOUNT_TYPES.find(([keyword]) => text.includes(keyword))?.[1] ?? null
}

/** Reads by column number; an unmapped or out-of-range column reads as empty. */
function cellAt(row: RawRow, column: number | undefined): unknown {
  return column == null ? null : (row.cells[column - 1] ?? null)
}

type Issues = PromotionRow['issues']

export function normalizeRow(
  sheetName: string,
  row: RawRow,
  mapping: ColumnMapping,
): PromotionRow {
  const issues: Issues = {}
  const raw = (field: ColumnField) => cellAt(row, mapping.columns[field])

  const flag = (field: keyof PromotionRow, issue: CellIssue) => {
    issues[field] = issue
  }

  /** Blank stays blank; unreadable text becomes a flagged null. */
  const text = (field: ColumnField) => cellText(raw(field))

  const num = (field: ColumnField & keyof PromotionRow): number | null => {
    const cell = raw(field)
    if (isBlankCell(cell)) return null
    const parsed = parseNumber(cell)
    if (!parsed.ok) {
      flag(field, 'unparsable-number')
      return null
    }
    return parsed.value
  }

  const date = (field: 'startAt' | 'endAt'): Date | null => {
    const cell = raw(field)
    if (isBlankCell(cell)) {
      flag(field, 'missing')
      return null
    }
    const parsed = parseExcelDate(cell)
    if (!parsed.ok) {
      flag(field, 'unparsable-date')
      return null
    }
    return parsed.value
  }

  const sku = text('sku')
  if (sku == null) flag('sku', 'missing')

  const discountTypeRaw = text('discountTypeRaw')
  if (discountTypeRaw == null) flag('discountTypeRaw', 'missing')

  const discountType = parseDiscountType(discountTypeRaw)
  if (discountTypeRaw != null && discountType == null) {
    flag('discountType', 'unknown-discount-type')
  }

  const programName = text('programName')
  if (programName == null) flag('programName', 'missing')

  return {
    sheetName,
    rowNumber: row.rowNumber,
    productCode: text('productCode'),
    sku,
    skuNormalized: normalizeSku(sku),
    productName: text('productName'),
    variantName: text('variantName'),
    unit: text('unit'),
    listPrice: num('listPrice'),
    usageLimit: num('usageLimit'),
    priceAfter: num('priceAfter'),
    discountAmount: num('discountAmount'),
    discountPercent: num('discountPercent'),
    discountTypeRaw,
    discountType,
    startAt: date('startAt'),
    endAt: date('endAt'),
    programName,
    issues,
  }
}

/** True when a row carries nothing at all - a spacer row, reported by rule A5. */
export function isEmptyRow(row: RawRow): boolean {
  return row.cells.every((cell) => isBlankCell(cell))
}
