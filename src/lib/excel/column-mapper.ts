/**
 * Binds header text to fields, so the reader survives columns being moved,
 * renamed slightly, or padded with an unnamed trailing column (the sample file
 * has one at position 15).
 *
 * Two passes, in this order:
 *   1. exact match on the normalised header
 *   2. substring match, longest keyword first
 *
 * The ordering is what stops `Mã` from swallowing `Mã hiệu`: `sku` wins its
 * column on the exact pass, and even if the header were `Mã hiệu SP`, the
 * 7-character keyword is tried before the 2-character one. Each column is
 * consumed once, so the two fields can never collide.
 */

import { cellText, normalizeHeader } from './cell-value'

export type ColumnField =
  | 'productCode'
  | 'sku'
  | 'productName'
  | 'variantName'
  | 'unit'
  | 'listPrice'
  | 'usageLimit'
  | 'priceAfter'
  | 'discountAmount'
  | 'discountPercent'
  | 'discountTypeRaw'
  | 'startAt'
  | 'endAt'
  | 'programName'

/**
 * Keywords are already normalised: whitespace collapsed, trimmed, lower-cased.
 * `startAt`/`endAt` match on a fragment because the real header reads
 * "Thời gian bắt đầu chương trình".
 */
const COLUMN_KEYWORDS: Record<ColumnField, readonly string[]> = {
  productCode: ['mã'],
  sku: ['mã hiệu'],
  productName: ['mặt hàng'],
  variantName: ['đặc tính'],
  unit: ['bộ đóng gói'],
  listPrice: ['giá niêm yết'],
  usageLimit: ['số dư'],
  priceAfter: ['giá sau giảm'],
  discountAmount: ['số tiền giảm'],
  discountPercent: ['phần trăm giảm'],
  discountTypeRaw: ['kiểu ctkm'],
  startAt: ['bắt đầu'],
  endAt: ['kết thúc'],
  programName: ['tên ctkm'],
}

export const COLUMN_FIELDS = Object.keys(COLUMN_KEYWORDS) as ColumnField[]

/** Without these three a sheet says nothing useful; rule A1 reports them. */
export const REQUIRED_FIELDS: readonly ColumnField[] = ['sku', 'discountTypeRaw', 'programName']

export type ColumnMapping = {
  /** Field -> 1-based column index, absent when the column was not found. */
  columns: Partial<Record<ColumnField, number>>
  /** Field -> the original header text that matched, for the per-sheet report. */
  matchedHeaders: Record<string, string | null>
  missingRequired: ColumnField[]
}

/** Longest keyword first, so a specific header claims its column before a generic one. */
const CANDIDATES = COLUMN_FIELDS.flatMap((field) =>
  COLUMN_KEYWORDS[field].map((keyword) => ({ field, keyword })),
).sort((a, b) => b.keyword.length - a.keyword.length)

export function mapColumns(headerCells: readonly unknown[]): ColumnMapping {
  // 1-based, mirroring Excel column numbers.
  const headers = headerCells.map((cell) => normalizeHeader(cell))
  const columns: Partial<Record<ColumnField, number>> = {}
  const takenColumns = new Set<number>()

  const claim = (field: ColumnField, index: number) => {
    columns[field] = index + 1
    takenColumns.add(index)
  }

  const findColumn = (matches: (header: string) => boolean) =>
    headers.findIndex(
      (header, index) => header != null && !takenColumns.has(index) && matches(header),
    )

  for (const { field, keyword } of CANDIDATES) {
    if (columns[field] != null) continue
    const index = findColumn((header) => header === keyword)
    if (index !== -1) claim(field, index)
  }

  for (const { field, keyword } of CANDIDATES) {
    if (columns[field] != null) continue
    const index = findColumn((header) => header.includes(keyword))
    if (index !== -1) claim(field, index)
  }

  // Reported as typed, not as normalised, so the user recognises their own header.
  const matchedHeaders = Object.fromEntries(
    COLUMN_FIELDS.map((field) => {
      const column = columns[field]
      return [field, column == null ? null : cellText(headerCells[column - 1])]
    }),
  )

  return {
    columns,
    matchedHeaders,
    missingRequired: REQUIRED_FIELDS.filter((field) => columns[field] == null),
  }
}
