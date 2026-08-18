/**
 * Data model for a parsed promotion workbook.
 *
 * Shapes verified against the real `promotion.t8.xlsx` on 2026-08-18:
 *   sheet "Key"             - 3929 data rows, 154 distinct programs
 *   sheet "Giảm phần trăm"  -    2 data rows
 *
 * Guiding rule: a cell that cannot be understood is recorded in `issues` and
 * left `null`. Nothing is ever quietly replaced by a default, because a
 * promotion carrying a silently invented date is worse than one flagged as
 * broken - the first ships, the second gets fixed.
 */

/** Why one cell could not be turned into a usable value. */
export type CellIssue =
  | 'missing'
  | 'unparsable-date'
  | 'unparsable-number'
  | 'unknown-discount-type'

/** Discount kinds Haravan accepts, derived from the free-text `Kiểu ctkm`. */
export type DiscountType = 'fixed_amount' | 'percentage' | 'same_price'

export type PromotionRow = {
  sheetName: string
  /** Real Excel row number, header included - so the user can jump straight to it. */
  rowNumber: number
  productCode: string | null // Mã
  sku: string | null // Mã hiệu
  /** Lookup key built by `normalizeSku`; null when the SKU cell is blank. */
  skuNormalized: string | null
  productName: string | null // Mặt hàng
  variantName: string | null // Đặc tính
  unit: string | null // Bộ đóng gói
  listPrice: number | null // Giá niêm yết
  usageLimit: number | null // Số dư
  priceAfter: number | null // Giá sau giảm
  discountAmount: number | null // Số tiền giảm
  /** Kept as stored, i.e. 0.5 for 50%. Haravan wants 50, the rule engine converts. */
  discountPercent: number | null // Phần trăm giảm
  discountTypeRaw: string | null // Kiểu ctkm, original text
  discountType: DiscountType | null
  startAt: Date | null
  endAt: Date | null
  programName: string | null // Tên ctkm
  issues: Partial<Record<keyof PromotionRow, CellIssue>>
}

/** Fallback bucket for rows whose `Tên ctkm` is blank - they still need checking. */
export const UNNAMED_PROGRAM = '(không có tên)'

/**
 * All rows sharing one `Tên ctkm`.
 *
 * The `distinct*` arrays exist because Haravan applies one discount per program:
 * if any of them holds more than one entry, the file describes a program that
 * cannot exist as written (rules D1-D5 in phase 04).
 */
export type PromotionProgram = {
  name: string
  rows: PromotionRow[]
  sheetNames: string[]
  distinctDiscountTypes: string[]
  distinctAmounts: (number | null)[]
  distinctPercents: (number | null)[]
  distinctStarts: (Date | null)[]
  distinctEnds: (Date | null)[]
  distinctUsageLimits: (number | null)[]
}

/** Which spreadsheet column ended up bound to each field, per sheet. */
export type SheetSummary = {
  name: string
  /** Data rows only, header excluded. */
  rowCount: number
  /** Field name -> the header text it matched, or null when unmatched. */
  mappedColumns: Record<string, string | null>
  /**
   * Excel row numbers of blank rows sitting *between* data rows. Trailing blanks
   * are excluded because they are how a spreadsheet normally ends; a blank in
   * the middle usually means the rows below it were pasted in separately, which
   * is what rule A5 warns about.
   */
  blankRowNumbers: number[]
}

export type WorkbookReadResult = {
  fileName: string
  /** SHA-256 of the uploaded bytes - lets a re-upload of the same file be recognised. */
  fileHash: string
  sheets: SheetSummary[]
  rows: PromotionRow[]
  programs: PromotionProgram[]
  /** Feeds rule A1. Sheets listed here contributed no rows. */
  missingRequiredColumns: { sheetName: string; missing: string[] }[]
}
