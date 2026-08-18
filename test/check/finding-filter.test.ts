/**
 * The filter lives in the URL, so these tests protect two promises the screen
 * makes: a reload keeps what you chose, and a hand-typed address cannot push
 * anything strange into a query.
 */

import { describe, expect, it } from 'vitest'
import { EMPTY_FILTER, filterHref, isFilterActive, parseFindingFilter } from '@/lib/check/finding-filter'

describe('reading the filter out of the address bar', () => {
  it('keeps every recognised parameter', () => {
    const filter = parseFindingFilter({
      muc: 'critical',
      luat: 'C2',
      ctkm: '2608GST0K',
      sku: 'KMAP240101',
      mo: '2608GST130K',
      trang: '3',
    })

    expect(filter).toEqual({
      severity: 'critical',
      ruleCode: 'C2',
      program: '2608GST0K',
      sku: 'KMAP240101',
      expandedProgram: '2608GST130K',
      page: 3,
    })
  })

  it('falls back to no filter when nothing is given', () => {
    expect(parseFindingFilter({})).toEqual(EMPTY_FILTER)
  })

  it('drops a severity that is not one of the three', () => {
    expect(parseFindingFilter({ muc: 'catastrophic' }).severity).toBeNull()
  })

  it('treats a blank or whitespace-only value as absent', () => {
    expect(parseFindingFilter({ sku: '   ', ctkm: '' }).sku).toBeNull()
    expect(parseFindingFilter({ sku: '   ', ctkm: '' }).program).toBeNull()
  })

  it('falls back to page 1 for a page number that cannot be used', () => {
    for (const trang of ['0', '-2', 'abc', '1.5', '']) {
      expect(parseFindingFilter({ trang }).page).toBe(1)
    }
  })

  it('takes the first value when a parameter is repeated', () => {
    expect(parseFindingFilter({ muc: ['warn', 'critical'] }).severity).toBe('warn')
  })

  it('caps a very long text so it cannot bloat the query', () => {
    const filter = parseFindingFilter({ ctkm: 'x'.repeat(5000) })
    expect(filter.program).toHaveLength(200)
  })
})

describe('building the link for a filter change', () => {
  const base = '/ket-qua/run1'

  it('keeps the untouched filters and drops the empty ones', () => {
    const filter = parseFindingFilter({ muc: 'critical', sku: 'ABC' })
    expect(filterHref(base, filter, { ruleCode: 'C2' })).toBe(
      '/ket-qua/run1?muc=critical&luat=C2&sku=ABC',
    )
  })

  it('returns the bare path once every filter is cleared', () => {
    const filter = parseFindingFilter({ muc: 'critical' })
    expect(filterHref(base, filter, { severity: null })).toBe(base)
  })

  it('goes back to page 1 whenever a filter other than the page changes', () => {
    const filter = parseFindingFilter({ trang: '7', muc: 'warn' })
    expect(filterHref(base, filter, { severity: 'critical' })).toBe('/ket-qua/run1?muc=critical')
  })

  it('keeps the rest of the filter when only the page changes', () => {
    const filter = parseFindingFilter({ muc: 'warn', trang: '2' })
    expect(filterHref(base, filter, { page: 3 })).toBe('/ket-qua/run1?muc=warn&trang=3')
  })

  it('escapes a program name that contains characters a URL cares about', () => {
    const filter = parseFindingFilter({})
    expect(filterHref(base, filter, { expandedProgram: 'KM 10% & 20%' })).toBe(
      '/ket-qua/run1?mo=KM+10%25+%26+20%25',
    )
  })
})

describe('knowing whether anything is filtered', () => {
  it('ignores the page and the expanded program', () => {
    expect(isFilterActive(parseFindingFilter({ trang: '4', mo: 'ABC' }))).toBe(false)
    expect(isFilterActive(parseFindingFilter({ muc: 'warn' }))).toBe(true)
  })
})
