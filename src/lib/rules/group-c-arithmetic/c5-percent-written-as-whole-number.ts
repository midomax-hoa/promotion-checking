/**
 * C5 - the percentage column holds `50` where `0.5` was meant.
 *
 * In this file format a percentage is always a decimal fraction (verified on
 * the sample: 0.5 and 0.3). Anything above 1 is therefore a hundred times too
 * large, and Haravan answers 422 for a percentage over 100 - so the program is
 * never created.
 */

import { formatPercent } from '../helpers/money'
import { rowRef } from '../helpers/row-ref'
import { numberParam, type Rule, type RuleFinding } from '../types'

const DEFAULT_MAX_PERCENT_VALUE = 1

export const c5PercentWrittenAsWholeNumber: Rule = {
  code: 'C5',
  groupCode: 'C',
  run(ctx): RuleFinding[] {
    const maxValue = numberParam(ctx.params, 'maxPercentValue', DEFAULT_MAX_PERCENT_VALUE)
    const findings: RuleFinding[] = []

    for (const row of ctx.workbook.rows) {
      const percent = row.discountPercent
      if (percent == null || percent <= maxValue) continue

      const intended = percent / 100
      findings.push({
        ...rowRef(row),
        message:
          `Dòng ${row.rowNumber}: cột "Phần trăm giảm" ghi ${percent}, tức ${formatPercent(percent)}. ` +
          `File này quy ước ghi dạng thập phân, nên ${percent} phải viết là ${intended}.`,
        suggestion:
          `Sửa thành ${intended} nếu ý là ${formatPercent(intended)}. ` +
          `Để nguyên thì Haravan sẽ từ chối vì phần trăm vượt quá 100.`,
      })
    }

    return findings
  },
}
