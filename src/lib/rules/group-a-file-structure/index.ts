import type { Rule } from '../types'
import { a1MissingRequiredColumns } from './a1-missing-required-columns'
import { a2SheetInventory } from './a2-sheet-inventory'
import { a3UnreadableDates } from './a3-unreadable-dates'
import { a4BlankSku } from './a4-blank-sku'
import { a5InterleavedBlankRows } from './a5-interleaved-blank-rows'

/** Group A - the file's own shape, checked without any external data. */
export const GROUP_A_RULES: readonly Rule[] = [
  a1MissingRequiredColumns,
  a2SheetInventory,
  a3UnreadableDates,
  a4BlankSku,
  a5InterleavedBlankRows,
]
