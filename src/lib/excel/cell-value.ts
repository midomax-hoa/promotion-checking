/**
 * Flattens the shapes `exceljs` hands back into plain values.
 *
 * Not an optional nicety: in the real `promotion.t8.xlsx` **every** `Tên ctkm`
 * and `Số tiền giảm` cell is a formula object, and the `Số dư` header is a
 * rich-text object. Reading `cell.value` straight would group all 3929 rows
 * under one `[object Object]` program and would never match the `Số dư` column.
 *
 * Shapes seen in the wild (verified 2026-08-18):
 *   { formula: 'F2-H2', result: 130000 }        - first cell of a shared formula
 *   { sharedFormula: 'I2', result: 130000 }     - the ones that follow
 *   { formula: '', result: 130000 }             - what the streaming reader emits
 *   { richText: [{ text: 'Số dư\n' }, { text: '(Để trống...)' }] }
 *   { text: 'label', hyperlink: 'https://...' }
 *   { error: '#DIV/0!' }                        - also valid as a formula result
 */

type Unknown = Record<string, unknown>

const isObject = (value: unknown): value is Unknown =>
  typeof value === 'object' && value !== null

/**
 * Unwraps to a primitive, a Date, or null.
 *
 * Formula errors come back as their text (`'#DIV/0!'`), never as null: the
 * number and date parsers then reject them and the row gets a visible issue,
 * whereas nulling them would read as a legitimately empty cell.
 */
export function unwrapCell(value: unknown): string | number | boolean | Date | null {
  if (value == null) return null
  if (value instanceof Date) return value
  if (!isObject(value)) return value as string | number | boolean

  if (Array.isArray(value.richText)) {
    const text = (value.richText as Unknown[])
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
    return text.length === 0 ? null : text
  }

  // Formula cells: the cached result is what the user sees in Excel.
  if ('result' in value) return unwrapCell(value.result)
  if ('formula' in value || 'sharedFormula' in value) return null

  if (typeof value.error === 'string') return value.error
  if (typeof value.text === 'string') return value.text

  return null
}

/** Display text for a cell: unwrapped, trimmed, null when nothing is left. */
export function cellText(value: unknown): string | null {
  const unwrapped = unwrapCell(value)
  if (unwrapped == null) return null
  const text = unwrapped instanceof Date ? unwrapped.toISOString() : String(unwrapped)
  const trimmed = text.trim()
  return trimmed.length === 0 ? null : trimmed
}

/**
 * True when the cell carries no value at all.
 *
 * Callers use this to tell `missing` apart from `unparsable-*`: an empty
 * `Số dư` means "no limit", whereas `Số dư = "abc"` means someone typed rubbish.
 */
export function isBlankCell(value: unknown): boolean {
  const unwrapped = unwrapCell(value)
  if (unwrapped == null) return true
  if (typeof unwrapped === 'string') return unwrapped.trim().length === 0
  return false
}

/**
 * Collapses every whitespace run - `\r\n` inside rich-text headers included -
 * into one space, then trims and lower-cases. Used for header matching only.
 */
export function normalizeHeader(value: unknown): string | null {
  const text = cellText(value)
  if (text == null) return null
  const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase()
  return normalized.length === 0 ? null : normalized
}
