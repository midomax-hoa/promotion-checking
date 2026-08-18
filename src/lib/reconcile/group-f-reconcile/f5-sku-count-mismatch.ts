/**
 * F5 - Haravan is not covering as many products as the file listed.
 *
 * This is the rule that catches the original problem the whole tool was built
 * for: the import tool looks each SKU up before sending, quietly drops the ones
 * it cannot find, and reports success. The promotion is created, just thinner
 * than anybody asked for.
 *
 * Counted on distinct SKUs rather than rows, because a program listing the same
 * SKU twice (rule E2) sends one variant to Haravan, not two - counting rows
 * would manufacture a shortfall out of a duplicate.
 *
 * Skipped, never guessed, when the attachment cannot be resolved: a promotion
 * that attaches whole products needs the catalog cache to say how many variants
 * each one holds, and an unsynced cache would turn every program into a critical
 * finding. See `promotion-mapper.ts`.
 */

import { UNNAMED_PROGRAM } from '@/lib/excel/types'
import type { RuleFinding } from '@/lib/rules/types'
import type { ReconcileRule } from '../types'
import { programLocation, soleMatch } from './finding-ref'

export const f5SkuCountMismatch: ReconcileRule = {
  code: 'F5',
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []

    for (const match of ctx.matches) {
      const promotion = soleMatch(match)
      if (promotion == null || match.expectation == null) continue
      if (promotion.attachedVariantCount == null) continue

      const skuCount = match.expectation.distinctSkuCount
      // A program with no usable SKU at all is rule A4's report, not a shortfall.
      if (skuCount === 0) continue
      if (skuCount === promotion.attachedVariantCount) continue

      const missing = skuCount - promotion.attachedVariantCount
      const label = match.programName === UNNAMED_PROGRAM ? 'Nhóm dòng không tên' : `Chương trình "${match.programName}"`

      findings.push({
        ...programLocation(match),
        message:
          `${label}: file có ${skuCount} mã hiệu khác nhau, Haravan chỉ đang áp cho ` +
          `${promotion.attachedVariantCount} biến thể` +
          (promotion.attachedByProduct ? ' (chương trình này đính theo sản phẩm, không theo từng biến thể)' : '') +
          `. ${missing > 0 ? `Thiếu ${missing}` : `Dư ${-missing}`} biến thể.`,
        suggestion:
          missing > 0
            ? 'Nhiều khả năng công cụ import không tra ra một số mã hiệu nên đã bỏ qua. ' +
              'Chạy lại màn kiểm tra file để biết mã nào không tồn tại trên Haravan.'
            : 'Haravan đang áp cho nhiều biến thể hơn file liệt kê. Kiểm tra lại xem có ai sửa tay ' +
              'chương trình này trên Haravan không.',
      })
    }

    return findings
  },
}
