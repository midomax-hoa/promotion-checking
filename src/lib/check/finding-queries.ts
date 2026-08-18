/**
 * Every read the result screen makes. Filtering, sorting and paging all happen
 * in PostgreSQL - a run holds thousands of findings and none of them belong in
 * the browser.
 *
 * `buildFindingWhere` is exported separately so the filter-to-SQL mapping can be
 * asserted without a database.
 */

import { prisma } from '@/lib/db/prisma'
import type { FindingFilter } from './finding-filter'

export type CheckRunSummary = {
  id: string
  fileName: string
  storedFileName: string | null
  createdAt: Date
  totalSheets: number
  totalRows: number
  totalPrograms: number
  countCritical: number
  countDanger: number
  countWarn: number
  catalogSyncedAt: Date | null
}

export type ProgramSummary = {
  name: string
  rowCount: number
  countCritical: number
  countDanger: number
  countWarn: number
}

export type FindingRecord = {
  id: string
  ruleCode: string
  severity: string
  sheetName: string | null
  rowNumber: number | null
  programName: string | null
  sku: string | null
  message: string
  suggestion: string | null
}

export type FindingPage = {
  items: FindingRecord[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

/**
 * Sorting by `severity` alphabetically happens to be the severity order we want:
 * critical < danger < warn. Kept because it needs no extra column; the three
 * words are fixed by the schema comment and asserted in the store tests.
 */
const SEVERITY_ORDER = { severity: 'asc' } as const

const FINDING_FIELDS = {
  id: true,
  ruleCode: true,
  severity: true,
  sheetName: true,
  rowNumber: true,
  programName: true,
  sku: true,
  message: true,
  suggestion: true,
} as const

/**
 * Program and SKU match on a substring, case-insensitively: people search by the
 * fragment they remember, not the exact string.
 */
export function buildFindingWhere(runId: string, filter: FindingFilter) {
  const insensitive = 'insensitive' as const
  return {
    runId,
    ...(filter.severity ? { severity: filter.severity } : {}),
    ...(filter.ruleCode ? { ruleCode: filter.ruleCode } : {}),
    ...(filter.program ? { programName: { contains: filter.program, mode: insensitive } } : {}),
    ...(filter.sku ? { sku: { contains: filter.sku, mode: insensitive } } : {}),
  }
}

export async function loadCheckRun(runId: string): Promise<CheckRunSummary | null> {
  return prisma.checkRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      fileName: true,
      storedFileName: true,
      createdAt: true,
      totalSheets: true,
      totalRows: true,
      totalPrograms: true,
      countCritical: true,
      countDanger: true,
      countWarn: true,
      catalogSyncedAt: true,
    },
  })
}

/** Heaviest programs first, so the thing that blocks the import is on screen without scrolling. */
export async function loadPrograms(runId: string): Promise<ProgramSummary[]> {
  return prisma.checkProgram.findMany({
    where: { runId },
    select: {
      name: true,
      rowCount: true,
      countCritical: true,
      countDanger: true,
      countWarn: true,
    },
    orderBy: [
      { countCritical: 'desc' },
      { countDanger: 'desc' },
      { countWarn: 'desc' },
      { name: 'asc' },
    ],
  })
}

/** The findings of one program, for the expanded row. Bounded so one huge program cannot flood the page. */
export async function loadProgramFindings(
  runId: string,
  programName: string,
  limit: number,
): Promise<FindingRecord[]> {
  return prisma.finding.findMany({
    where: { runId, programName },
    select: FINDING_FIELDS,
    orderBy: [SEVERITY_ORDER, { rowNumber: 'asc' }],
    take: limit,
  })
}

/**
 * Findings that belong to no program - missing columns, sheet inventory, an
 * empty catalog. Bounded even though there should only ever be a handful: this
 * list is rendered unpaginated, so an unexpected flood would land in the
 * browser whole.
 */
export async function loadFileLevelFindings(
  runId: string,
  limit: number,
): Promise<FindingRecord[]> {
  return prisma.finding.findMany({
    where: { runId, programName: null },
    select: FINDING_FIELDS,
    orderBy: [SEVERITY_ORDER, { ruleCode: 'asc' }],
    take: limit,
  })
}

export async function loadFindingPage(
  runId: string,
  filter: FindingFilter,
  pageSize: number,
): Promise<FindingPage> {
  const where = buildFindingWhere(runId, filter)
  const total = await prisma.finding.count({ where })
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  // Clamped rather than rejected: narrowing a filter while on page 9 must not 404.
  const page = Math.min(filter.page, pageCount)

  const items = await prisma.finding.findMany({
    where,
    select: FINDING_FIELDS,
    orderBy: [SEVERITY_ORDER, { ruleCode: 'asc' }, { rowNumber: 'asc' }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  })

  return { items, total, page, pageSize, pageCount }
}

/** Rule codes actually present in this run, for the filter dropdown. */
export async function loadRuleCodes(runId: string): Promise<{ code: string; count: number }[]> {
  const groups = await prisma.finding.groupBy({
    by: ['ruleCode'],
    where: { runId },
    _count: { _all: true },
  })
  return groups
    .map((group) => ({ code: group.ruleCode, count: group._count._all }))
    .sort((a, b) => a.code.localeCompare(b.code))
}
