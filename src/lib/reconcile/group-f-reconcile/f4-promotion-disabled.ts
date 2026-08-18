/**
 * F4 - the promotion exists on Haravan but is switched off.
 *
 * A warning rather than an error: leaving a campaign disabled until launch day
 * is normal practice. It is here because "the import worked" and "the discount
 * is actually running" are different statements, and only one of them is what
 * anybody meant to check.
 */

import type { RuleFinding } from '@/lib/rules/types'
import type { ReconcileRule } from '../types'
import { programLocation, soleMatch } from './finding-ref'

export const f4PromotionDisabled: ReconcileRule = {
  code: 'F4',
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []

    for (const match of ctx.matches) {
      const promotion = soleMatch(match)
      if (promotion == null || promotion.active) continue

      findings.push({
        ...programLocation(match),
        message:
          `Chương trình "${match.programName}" đã có trên Haravan nhưng đang ở trạng thái ` +
          `"${promotion.status ?? 'không rõ'}", tức là chưa chạy.`,
        suggestion:
          'Nếu định để dành tới ngày khai mạc thì bỏ qua. Nếu không, bật chương trình lên trên Haravan.',
      })
    }

    return findings
  },
}
