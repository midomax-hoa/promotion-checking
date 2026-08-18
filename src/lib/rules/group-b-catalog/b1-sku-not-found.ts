/**
 * B1 - the SKU does not exist on Haravan. The single most valuable rule here.
 *
 * Why: the in-house import tool looks each SKU up first and quietly drops the
 * ones it cannot find, then reports the program as created successfully. The
 * promotion ships missing products and nothing anywhere says so. Catching it
 * before import is the whole reason this tool exists.
 *
 * The near-match suggestion is built once per run (see `levenshtein.ts`), so
 * the cost is one index build plus a short bucket scan per unknown SKU.
 */

import {
  DEFAULT_COMPARISON_BUDGET,
  buildSimilarityIndex,
  findClosest,
  isBudgetExhausted,
  type SimilarityIndex,
} from '../helpers/levenshtein'
import { rowRef } from '../helpers/row-ref'
import { numberParam, type Rule, type RuleFinding } from '../types'

const DEFAULT_SUGGEST_MAX_DISTANCE = 2

const GENERIC_ADVICE =
  'Kiểm tra lại mã hiệu, hoặc đồng bộ lại danh mục nếu sản phẩm này vừa được tạo trên Haravan.'

/**
 * Said once the near-match search has spent its budget - which only happens
 * when a large share of the file is unknown to the catalog. Guessing at
 * individual codes is not the useful advice at that point.
 */
const BUDGET_SPENT_ADVICE =
  'Có quá nhiều mã hiệu không tra ra nên đã dừng gợi ý mã gần giống. ' +
  'Nhiều khả năng danh mục chưa đồng bộ hoặc đang trỏ sai cửa hàng - hãy đồng bộ lại rồi kiểm tra lần nữa.'

export const b1SkuNotFound: Rule = {
  code: 'B1',
  groupCode: 'B',
  requires: ['catalog'],
  run(ctx): RuleFinding[] {
    const maxDistance = numberParam(ctx.params, 'suggestMaxDistance', DEFAULT_SUGGEST_MAX_DISTANCE)
    const budget = numberParam(ctx.params, 'suggestMaxComparisons', DEFAULT_COMPARISON_BUDGET)
    const findings: RuleFinding[] = []

    // Built lazily: a clean file never pays for it.
    let index: SimilarityIndex | null = null
    // Same typo repeated on 50 rows should cost one distance search, not 50.
    const suggestionCache = new Map<string, string | null>()

    for (const row of ctx.workbook.rows) {
      const key = row.skuNormalized
      // A blank SKU is rule A4's business; it can never be looked up.
      if (key == null) continue
      if (ctx.catalog.bySku.has(key)) continue

      let suggestion = suggestionCache.get(key)
      if (suggestion === undefined) {
        index ??= buildSimilarityIndex(ctx.catalog.allSkus, budget)
        suggestion = maxDistance > 0 ? findClosest(index, key, maxDistance) : null
        suggestionCache.set(key, suggestion)
      }

      const noSuggestionAdvice =
        index != null && isBudgetExhausted(index) ? BUDGET_SPENT_ADVICE : GENERIC_ADVICE

      findings.push({
        ...rowRef(row),
        message:
          `Dòng ${row.rowNumber}: mã hiệu "${row.sku}" không có trên Haravan. ` +
          `Công cụ import sẽ lặng lẽ bỏ qua dòng này, chương trình vẫn báo tạo thành công.`,
        suggestion:
          suggestion != null
            ? `Có phải ý là "${suggestion}" không? Nếu đúng thì sửa lại mã hiệu trong file.`
            : noSuggestionAdvice,
      })
    }

    return findings
  },
}
