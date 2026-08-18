/**
 * Upload limits, kept in a module of their own with no dependencies.
 *
 * The drop panel is a client component and needs the cap to write the label.
 * Importing it from `promotion-workbook.ts` would drag `exceljs` into the
 * browser bundle for the sake of one number.
 */

/** Enforced at the API boundary and again when the workbook is read. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

export const MAX_UPLOAD_MB = Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)
