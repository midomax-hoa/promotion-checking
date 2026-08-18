/**
 * D8 - a promotion with this name already exists on Haravan.
 *
 * Haravan allows duplicate names (verified on the dev store), so importing
 * creates a second program rather than updating the first. Both then apply, and
 * which discount a customer gets is anyone's guess.
 *
 * Needs the promotion list; without it the rule is skipped and recorded, never
 * quietly treated as "no duplicates".
 */

import { UNNAMED_PROGRAM } from '@/lib/excel/types'
import type { Rule, RuleFinding } from '../types'
import { formatDate, programRef } from './program-ref'

export const d8ProgramNameExists: Rule = {
  code: 'D8',
  groupCode: 'D',
  requires: ['haravan-promotions'],
  run(ctx): RuleFinding[] {
    const existing = new Map<string, string[]>()
    for (const promotion of ctx.haravanPromotions ?? []) {
      const key = promotion.name.trim().toLowerCase()
      const label = `${promotion.name} (${formatDate(promotion.startAt)} - ${formatDate(promotion.endAt)})`
      const bucket = existing.get(key)
      if (bucket) bucket.push(label)
      else existing.set(key, [label])
    }

    const findings: RuleFinding[] = []

    for (const program of ctx.workbook.programs) {
      if (program.name === UNNAMED_PROGRAM) continue
      const matches = existing.get(program.name.trim().toLowerCase())
      if (matches == null) continue

      findings.push({
        ...programRef(program),
        message:
          `Chương trình "${program.name}" đã có trên Haravan: ${matches.join('; ')}. ` +
          `Import lần nữa sẽ tạo thêm một chương trình trùng tên, không phải cập nhật cái cũ.`,
        suggestion:
          'Đổi tên chương trình trong file, hoặc xoá chương trình cũ trên Haravan trước khi import.',
      })
    }

    return findings
  },
}
