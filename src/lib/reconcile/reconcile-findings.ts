/**
 * Findings the engine produces itself, on top of what the six rules report.
 *
 * All three concern the *quality of the comparison* rather than a business
 * rule, which is why they carry system codes and cannot be switched off from
 * the configuration screen: a run that quietly dropped its "I could not tell"
 * notice would read as a clean reconciliation.
 */

import type { EngineFinding } from '@/lib/rules/engine'
import { SYSTEM_RECONCILE_AMBIGUOUS, SYSTEM_RECONCILE_DISAGREED } from '@/lib/rules/rule-catalog'
import type { Severity } from '@/lib/rules/types'
import { formatDiscount, formatInstant } from './group-f-reconcile/finding-ref'
import { normalizeProgramName } from './promotion-matcher'
import type { MatchResult } from './types'

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, danger: 1, warn: 2 }

/**
 * Every finding about a name both passes agreed was missing survives; a finding
 * about a name only one pass missed is dropped as index lag.
 */
export function keepAgreedFindings(
  findings: readonly EngineFinding[],
  disputed: ReadonlySet<string>,
): EngineFinding[] {
  if (disputed.size === 0) return [...findings]
  return findings.filter(
    (finding) =>
      finding.ruleCode !== 'F1' || !disputed.has(normalizeProgramName(finding.programName)),
  )
}

/** Duplicate names are listed in full so the user picks, rather than the tool guessing. */
export function ambiguousFindings(
  matches: readonly MatchResult[],
  offsetMinutes: number,
): EngineFinding[] {
  return matches
    .filter((match) => match.status === 'ambiguous')
    .map((match) => {
      const listed = match.haravanMatches
        .map(
          (promotion) =>
            `#${promotion.id} (${formatInstant(promotion.startAt, offsetMinutes)} - ` +
            `${formatInstant(promotion.endAt, offsetMinutes)}, ` +
            `${formatDiscount(promotion.value, promotion.takeType)}, ` +
            `${promotion.status ?? 'không rõ'})`,
        )
        .join('; ')
      return {
        ruleCode: SYSTEM_RECONCILE_AMBIGUOUS,
        severity: 'danger' as Severity,
        sheetName: match.excelProgram?.sheetNames.join(', '),
        programName: match.programName,
        message:
          `Haravan có ${match.haravanMatches.length} chương trình cùng tên ` +
          `"${match.programName}": ${listed}. Không tự đối chiếu được cái nào là cái vừa import.`,
        suggestion:
          'Vào Haravan xem từng chương trình trùng tên rồi tự đối chiếu, hoặc tắt/xoá bớt cái ' +
          'thừa rồi chạy lại đối soát.',
      }
    })
}

export const DISAGREED_FINDING: EngineFinding = {
  ruleCode: SYSTEM_RECONCILE_DISAGREED,
  severity: 'warn',
  message:
    'Hai lượt đối soát cho kết quả khác nhau: có chương trình lượt đầu không thấy nhưng lượt sau ' +
    'lại thấy. Danh sách chương trình của Haravan cập nhật chậm vài giây sau khi tạo.',
  suggestion:
    'Nếu vừa import xong thì chờ vài phút rồi chạy lại đối soát. Kết quả lần này đã bỏ qua những ' +
    'chương trình chỉ thiếu ở lượt đầu, nên vẫn dùng được, chỉ là chưa chắc chắn hoàn toàn.',
}

/** Worst first, then by rule code, then by program - the order the screen reads in. */
export function sortFindings(findings: EngineFinding[]): EngineFinding[] {
  return findings.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.ruleCode.localeCompare(b.ruleCode) ||
      (a.programName ?? '').localeCompare(b.programName ?? ''),
  )
}

export function countBySeverity(findings: readonly EngineFinding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, danger: 0, warn: 0 }
  for (const finding of findings) counts[finding.severity] += 1
  return counts
}
