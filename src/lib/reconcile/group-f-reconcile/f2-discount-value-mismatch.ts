/**
 * F2 - Haravan is running a different discount than the file asked for.
 *
 * Two comparisons in one rule, because they are the same question: the kind of
 * discount, then its size. A file asking for 50.000d off that became 50% off is
 * the more expensive of the two mistakes and would otherwise pass the size check
 * by accident, since both sides would hold the number 50.
 *
 * Both sides arrive in Haravan's unit - `readExpectation` has already turned the
 * file's 0.5 into 50 - so nothing here multiplies anything.
 */

import { moneyEquals } from '@/lib/rules/helpers/money'
import { numberParam, type RuleFinding } from '@/lib/rules/types'
import type { ReconcileRule } from '../types'
import { formatDiscount, programLocation, soleMatch } from './finding-ref'

/** Percentages are whole numbers on both sides, so this only absorbs float noise. */
const DEFAULT_PERCENT_TOLERANCE = 0.01

const KIND_LABELS: Record<string, string> = {
  fixed_amount: 'giảm số tiền',
  percentage: 'giảm phần trăm',
}

function kindLabel(kind: string | null): string {
  return kind == null ? '(không rõ)' : (KIND_LABELS[kind] ?? kind)
}

export const f2DiscountValueMismatch: ReconcileRule = {
  code: 'F2',
  run(ctx): RuleFinding[] {
    const percentTolerance = numberParam(
      ctx.params,
      'percentTolerance',
      DEFAULT_PERCENT_TOLERANCE,
    )
    const findings: RuleFinding[] = []

    for (const match of ctx.matches) {
      const promotion = soleMatch(match)
      const expectation = match.expectation
      if (promotion == null || expectation == null || expectation.inconsistent) continue

      // `same_price` names a final price, not a reduction, so Haravan's single
      // `value` has nothing to be compared against.
      if (expectation.discountType == null || expectation.discountType === 'same_price') continue

      if (promotion.takeType !== expectation.discountType) {
        findings.push({
          ...programLocation(match),
          message:
            `Chương trình "${match.programName}": file ghi ${kindLabel(expectation.discountType)}, ` +
            `Haravan đang để ${kindLabel(promotion.takeType)} với giá trị ` +
            `${formatDiscount(promotion.value, promotion.takeType)}.`,
          suggestion:
            'Sửa lại kiểu khuyến mãi trên Haravan cho khớp file, hoặc xoá rồi import lại. ' +
            'Nhầm giữa số tiền và phần trăm là sai lệch tốn tiền nhất.',
        })
        continue
      }

      if (expectation.value == null || promotion.value == null) continue

      const tolerance =
        expectation.discountType === 'percentage' ? percentTolerance : ctx.moneyToleranceVnd
      if (Math.abs(expectation.value - promotion.value) <= tolerance) continue
      if (expectation.discountType === 'fixed_amount') {
        if (moneyEquals(expectation.value, promotion.value, ctx.moneyToleranceVnd)) continue
      }

      findings.push({
        ...programLocation(match),
        message:
          `Chương trình "${match.programName}": file ghi ` +
          `${formatDiscount(expectation.value, expectation.discountType)}, Haravan đang để ` +
          `${formatDiscount(promotion.value, promotion.takeType)}.`,
        suggestion: 'Sửa giá trị giảm trên Haravan cho khớp file, hoặc xoá rồi import lại.',
      })
    }

    return findings
  },
}
