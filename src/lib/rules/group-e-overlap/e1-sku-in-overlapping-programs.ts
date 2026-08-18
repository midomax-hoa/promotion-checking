/**
 * E1 - one SKU sits in two programs whose date windows overlap.
 *
 * Haravan then has two active discounts for the same variant and picks one; the
 * shelf price stops being predictable from the file. Danger rather than
 * critical because both programs are created successfully - the damage only
 * shows up at the till.
 *
 * Indexed by SKU first, so the comparison is per-SKU pairs (usually 2-3
 * programs) rather than every program against every other one.
 */

import { windowsOverlap } from '../helpers/date-range'
import type { Rule, RuleFinding } from '../types'
import { formatDate } from '../helpers/date-range'
import type { PromotionRow } from '@/lib/excel/types'

type ProgramSlot = { program: string; row: PromotionRow }

export const e1SkuInOverlappingPrograms: Rule = {
  code: 'E1',
  groupCode: 'E',
  run(ctx): RuleFinding[] {
    const bySku = new Map<string, ProgramSlot[]>()

    for (const row of ctx.workbook.rows) {
      if (row.skuNormalized == null || row.programName == null) continue
      const slots = bySku.get(row.skuNormalized)
      // One slot per program: repeats inside a program are rule E2's report.
      if (slots == null) bySku.set(row.skuNormalized, [{ program: row.programName, row }])
      else if (!slots.some((slot) => slot.program === row.programName)) {
        slots.push({ program: row.programName, row })
      }
    }

    const findings: RuleFinding[] = []

    for (const slots of bySku.values()) {
      if (slots.length < 2) continue

      for (let i = 0; i < slots.length; i += 1) {
        for (let j = i + 1; j < slots.length; j += 1) {
          const a = slots[i]
          const b = slots[j]
          const windowA = { start: a.row.startAt, end: a.row.endAt }
          const windowB = { start: b.row.startAt, end: b.row.endAt }
          if (!windowsOverlap(windowA, windowB)) continue

          findings.push({
            sheetName: a.row.sheetName,
            rowNumber: a.row.rowNumber,
            programName: a.program,
            sku: a.row.sku ?? undefined,
            message:
              `Mã hiệu "${a.row.sku}" nằm trong 2 chương trình có thời gian giao nhau: ` +
              `"${a.program}" (${formatDate(windowA.start)} - ${formatDate(windowA.end)}, dòng ${a.row.rowNumber}) ` +
              `và "${b.program}" (${formatDate(windowB.start)} - ${formatDate(windowB.end)}, dòng ${b.row.rowNumber}).`,
            suggestion:
              'Haravan sẽ có 2 khuyến mãi cùng chạy cho biến thể này, không đoán được khách hưởng cái nào. ' +
              'Tách thời gian hai chương trình, hoặc bỏ mã hiệu này khỏi một trong hai.',
          })
        }
      }
    }

    return findings
  },
}
