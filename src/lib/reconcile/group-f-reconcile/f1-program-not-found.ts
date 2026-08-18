/**
 * F1 - the file has this program, Haravan does not.
 *
 * The most important finding on the screen, and the easiest one to get wrong.
 * Haravan's promotion list lags about five seconds behind a create, so running
 * this straight after an import would report every single program as missing.
 * The two-pass mechanism in `reconcile-engine.ts` is what stops that: by the
 * time a match reaches this rule as `not-found`, two separate fetches have
 * agreed on it.
 */

import { UNNAMED_PROGRAM } from '@/lib/excel/types'
import type { RuleFinding } from '@/lib/rules/types'
import type { ReconcileRule } from '../types'
import { programLocation } from './finding-ref'

export const f1ProgramNotFound: ReconcileRule = {
  code: 'F1',
  run(ctx): RuleFinding[] {
    const findings: RuleFinding[] = []

    for (const match of ctx.matches) {
      if (match.status !== 'not-found') continue
      const rowCount = match.expectation?.rowCount ?? 0
      const named = match.programName !== UNNAMED_PROGRAM

      findings.push({
        ...programLocation(match),
        message: named
          ? `Chương trình "${match.programName}" (${rowCount} dòng trong file) không có trên Haravan.`
          : `Nhóm dòng không có tên chương trình (${rowCount} dòng) không đối chiếu được với Haravan.`,
        suggestion: named
          ? 'Kiểm tra lại xem đã import chương trình này chưa. Nếu đã import mà vẫn báo thiếu ' +
            'thì nhiều khả năng công cụ import đã bỏ qua nó, xem lại thông báo lúc import.'
          : 'Điền cột Tên ctkm cho các dòng này rồi import lại, không có tên thì không đối chiếu được.',
      })
    }

    return findings
  },
}
