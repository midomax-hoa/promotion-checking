/**
 * The filter state, read from and written back to the address bar.
 *
 * Deliberately not React state: the screen has to survive a reload and be
 * shareable as a link, and the 3.929 rows must never reach the browser in the
 * first place. So the filter travels as `searchParams`, the server queries with
 * it, and every control is a plain link or a GET form.
 *
 * Pure on purpose - no Prisma, no request - so the parsing rules are testable
 * on their own.
 */

import type { Severity } from '@/lib/rules/types'

export type SearchParamsInput = Record<string, string | string[] | undefined>

export type FindingFilter = {
  severity: Severity | null
  ruleCode: string | null
  program: string | null
  sku: string | null
  /** Exact program name whose findings are shown inline in the program table. */
  expandedProgram: string | null
  /** 1-based; anything unusable falls back to the first page. */
  page: number
}

export const EMPTY_FILTER: FindingFilter = {
  severity: null,
  ruleCode: null,
  program: null,
  sku: null,
  expandedProgram: null,
  page: 1,
}

const SEVERITIES: readonly Severity[] = ['critical', 'danger', 'warn']

/** Long enough for any real program name, short enough to keep the query bounded. */
const MAX_TEXT_LENGTH = 200

function readOne(params: SearchParamsInput, key: string): string | null {
  const raw = params[key]
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, MAX_TEXT_LENGTH)
  return trimmed === '' ? null : trimmed
}

function readPage(params: SearchParamsInput): number {
  const raw = readOne(params, 'trang')
  const page = Number(raw)
  return Number.isInteger(page) && page > 0 ? page : 1
}

export function parseFindingFilter(params: SearchParamsInput): FindingFilter {
  const severity = readOne(params, 'muc')
  return {
    severity: SEVERITIES.includes(severity as Severity) ? (severity as Severity) : null,
    ruleCode: readOne(params, 'luat'),
    program: readOne(params, 'ctkm'),
    sku: readOne(params, 'sku'),
    expandedProgram: readOne(params, 'mo'),
    page: readPage(params),
  }
}

/** Vietnamese keys so the address bar stays readable for the people using it. */
const PARAM_KEYS: Record<keyof FindingFilter, string> = {
  severity: 'muc',
  ruleCode: 'luat',
  program: 'ctkm',
  sku: 'sku',
  expandedProgram: 'mo',
  page: 'trang',
}

/**
 * A link that changes part of the filter and keeps the rest. Any change other
 * than paging resets to page 1, otherwise narrowing a filter can land on a page
 * that no longer exists.
 */
export function filterHref(
  basePath: string,
  filter: FindingFilter,
  changes: Partial<FindingFilter>,
): string {
  const next: FindingFilter = { ...filter, ...changes }
  // Expanding a program changes nothing about the finding page, so it must not
  // throw someone reading page 5 back to page 1.
  const keepsPage = 'page' in changes || Object.keys(changes).every((key) => key === 'expandedProgram')
  if (!keepsPage) next.page = 1

  const query = new URLSearchParams()
  for (const [field, key] of Object.entries(PARAM_KEYS) as [keyof FindingFilter, string][]) {
    const value = next[field]
    if (value === null || value === '') continue
    if (field === 'page' && value === 1) continue
    query.set(key, String(value))
  }

  const suffix = query.toString()
  return suffix ? `${basePath}?${suffix}` : basePath
}

export function isFilterActive(filter: FindingFilter): boolean {
  return (
    filter.severity !== null ||
    filter.ruleCode !== null ||
    filter.program !== null ||
    filter.sku !== null
  )
}
