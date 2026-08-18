/**
 * E2 - the same SKU appears twice inside one program.
 *
 * Critical: Haravan answers 422 for a duplicated variant in the entitled list
 * (verified on the dev store), so the whole program fails - every other SKU in
 * it loses its discount because of one repeated line.
 */

import { rowRef } from '../helpers/row-ref'
import type { Rule, RuleFinding } from '../types'

export const e2DuplicateSkuInProgram: Rule = {
  code: 'E2',
  groupCode: 'E',
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []

    for (const program of ctx.workbook.programs) {
      const firstSeen = new Map<string, number>()

      for (const row of program.rows) {
        if (row.skuNormalized == null) continue
        const previous = firstSeen.get(row.skuNormalized)
        if (previous == null) {
          firstSeen.set(row.skuNormalized, row.rowNumber)
          continue
        }

        findings.push({
          ...rowRef(row),
          message:
            `Dòng ${row.rowNumber}: mã hiệu "${row.sku}" đã có ở dòng ${previous} trong cùng chương trình ` +
            `"${program.name}". Haravan sẽ từ chối (lỗi 422), cả chương trình không được tạo.`,
          suggestion: `Xoá dòng ${row.rowNumber}, hoặc gộp với dòng ${previous} nếu hai dòng khác nhau về mức giảm.`,
        })
      }
    }

    return findings
  },
}
