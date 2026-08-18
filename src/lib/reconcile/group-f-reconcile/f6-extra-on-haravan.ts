/**
 * F6 - Haravan is running a promotion the file never mentioned.
 *
 * A warning, because most of them are legitimate: campaigns created by hand,
 * or left over from an earlier file. It earns its place by catching the two
 * cases that are not - an import run twice under a slightly different name, and
 * an old campaign nobody remembered to switch off.
 *
 * Only promotions whose window overlaps the file's reach this rule; the
 * matcher filters the rest out. A shop with three years of history would
 * otherwise drown this screen in campaigns that ended long ago.
 */

import type { RuleFinding } from '@/lib/rules/types'
import type { ReconcileRule } from '../types'
import { formatDiscount, formatInstant, programLocation } from './finding-ref'

export const f6ExtraOnHaravan: ReconcileRule = {
  code: 'F6',
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []
    const offset = ctx.shopTimezoneOffsetMinutes

    for (const match of ctx.matches) {
      if (match.status !== 'extra-on-haravan') continue
      const promotion = match.haravanMatches[0]
      if (promotion == null) continue

      const window = `${formatInstant(promotion.startAt, offset)} - ${formatInstant(promotion.endAt, offset)}`

      findings.push({
        ...programLocation(match),
        message:
          `Haravan đang có chương trình "${promotion.name}" (${window}, ` +
          `${formatDiscount(promotion.value, promotion.takeType)}) trùng khoảng thời gian với file, ` +
          `nhưng file không có chương trình nào tên vậy.`,
        suggestion:
          'Nếu là chương trình tạo tay thì bỏ qua. Nếu là lần import trước bị lệch tên thì nên tắt ' +
          'chương trình cũ, tránh hai chương trình cùng áp lên một mã hiệu.',
      })
    }

    return findings
  },
}
