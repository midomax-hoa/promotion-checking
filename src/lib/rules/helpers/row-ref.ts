/**
 * Every row-level finding carries the same four locators so the report screen
 * can link straight back to the cell. Written once, because a finding missing
 * its sheet name is a finding the user cannot act on.
 */

import type { PromotionRow } from '@/lib/excel/types'
import type { RuleFinding } from '../types'

export function rowRef(row: PromotionRow): Pick<
  RuleFinding,
  'sheetName' | 'rowNumber' | 'programName' | 'sku'
> {
  return {
    sheetName: row.sheetName,
    rowNumber: row.rowNumber,
    programName: row.programName ?? undefined,
    sku: row.sku ?? undefined,
  }
}
