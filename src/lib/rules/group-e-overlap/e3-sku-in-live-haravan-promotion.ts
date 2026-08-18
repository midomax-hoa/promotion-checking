/**
 * E3 - the SKU is already covered by a live promotion on Haravan.
 *
 * Same collision as E1, but with a program that is not in this file, so it is
 * invisible to whoever prepared it. A warning, because running two campaigns
 * over one product on purpose is a normal thing to do.
 *
 * Needs the promotion list. Without it the rule is skipped and recorded - never
 * reported as "no conflict".
 */

import { windowsOverlap, formatDate } from '../helpers/date-range'
import { rowRef } from '../helpers/row-ref'
import type { HaravanPromotion, Rule, RuleFinding } from '../types'

export const e3SkuInLiveHaravanPromotion: Rule = {
  code: 'E3',
  groupCode: 'E',
  requires: ['haravan-promotions'],
  run(ctx): RuleFinding[] {
    const bySku = new Map<string, HaravanPromotion[]>()
    for (const promotion of ctx.haravanPromotions ?? []) {
      if (!promotion.active) continue
      for (const sku of promotion.skus) {
        const bucket = bySku.get(sku)
        if (bucket) bucket.push(promotion)
        else bySku.set(sku, [promotion])
      }
    }
    if (bySku.size === 0) return []

    const findings: RuleFinding[] = []

    for (const row of ctx.workbook.rows) {
      if (row.skuNormalized == null) continue
      const promotions = bySku.get(row.skuNormalized)
      if (promotions == null) continue

      const rowWindow = { start: row.startAt, end: row.endAt }
      const clashing = promotions.filter(
        (promotion) =>
          // A program of the same name is D8's report, not an overlap surprise.
          promotion.name.trim().toLowerCase() !== (row.programName ?? '').trim().toLowerCase() &&
          windowsOverlap(rowWindow, { start: promotion.startAt, end: promotion.endAt }),
      )
      if (clashing.length === 0) continue

      const listed = clashing
        .map((p) => `"${p.name}" (${formatDate(p.startAt)} - ${formatDate(p.endAt)})`)
        .join(', ')

      findings.push({
        ...rowRef(row),
        message:
          `Dòng ${row.rowNumber}: mã hiệu "${row.sku}" đang nằm trong chương trình khác đang chạy ` +
          `trên Haravan: ${listed}.`,
        suggestion:
          'Nếu cố ý chạy song song thì bỏ qua. Nếu không, tắt chương trình cũ trên Haravan ' +
          'hoặc bỏ mã hiệu này khỏi file.',
      })
    }

    return findings
  },
}
