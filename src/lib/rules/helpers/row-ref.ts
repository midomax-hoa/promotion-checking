/**
 * Every row-level finding carries the same four locators so the report screen
 * can link straight back to the cell. Written once, because a finding missing
 * its sheet name is a finding the user cannot act on.
 */

import { programKey } from '@/lib/excel/program-grouper'
import type { PromotionRow } from '@/lib/excel/types'
import type { RuleFinding } from '../types'

export function rowRef(row: PromotionRow): Pick<
  RuleFinding,
  'sheetName' | 'rowNumber' | 'programName' | 'sku'
> {
  return {
    sheetName: row.sheetName,
    rowNumber: row.rowNumber,
    // Through `programKey`, not the raw cell: a blank name is bucketed as
    // `(không có tên)` when programs are grouped, and a finding that said `null`
    // instead would detach from its own program - which then renders as clean.
    programName: programKey(row),
    sku: row.sku ?? undefined,
  }
}
