/**
 * The filter-to-SQL mapping. Asserted without a database because the thing that
 * can silently break is the shape of the `where` object, not PostgreSQL.
 */

import { describe, expect, it } from 'vitest'
import { parseFindingFilter } from '@/lib/check/finding-filter'
import { buildFindingWhere } from '@/lib/check/finding-queries'

describe('turning a filter into a query', () => {
  it('narrows to one run when nothing is filtered', () => {
    expect(buildFindingWhere('run1', parseFindingFilter({}))).toEqual({ runId: 'run1' })
  })

  it('matches severity and rule code exactly', () => {
    const where = buildFindingWhere('run1', parseFindingFilter({ muc: 'critical', luat: 'C2' }))
    expect(where).toEqual({ runId: 'run1', severity: 'critical', ruleCode: 'C2' })
  })

  it('matches program and SKU on a case-insensitive substring', () => {
    const where = buildFindingWhere('run1', parseFindingFilter({ ctkm: 'gst0k', sku: 'kmap' }))
    expect(where).toEqual({
      runId: 'run1',
      programName: { contains: 'gst0k', mode: 'insensitive' },
      sku: { contains: 'kmap', mode: 'insensitive' },
    })
  })

  it('ignores the page and the expanded program, which are not filters', () => {
    const where = buildFindingWhere('run1', parseFindingFilter({ trang: '5', mo: 'ABC' }))
    expect(where).toEqual({ runId: 'run1' })
  })
})
