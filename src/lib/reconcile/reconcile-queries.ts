/**
 * Every read the reconciliation screens make.
 *
 * Split from `finding-queries.ts` because it answers a different question: that
 * file is about findings, this one is about the two sides of a comparison. The
 * findings of a reconciliation run are read with the existing queries - a run is
 * a `CheckRun` either way.
 */

import { prisma } from '@/lib/db/prisma'

export type ReconcileMatchRecord = {
  id: string
  programName: string
  status: string
  excelRowCount: number | null
  excelSkuCount: number | null
  excelDiscountType: string | null
  excelValue: number | null
  excelStartAt: Date | null
  excelEndAt: Date | null
  haravanId: string | null
  haravanTakeType: string | null
  haravanValue: number | null
  haravanStartAt: Date | null
  haravanEndAt: Date | null
  haravanStatus: string | null
  haravanVariantCount: number | null
  haravanByProduct: boolean
}

/** A file to reconcile: a past check run whose original upload is still on disk. */
export type ReconcileSourceOption = {
  id: string
  fileName: string
  createdAt: Date
  totalRows: number
  totalPrograms: number
}

const MATCH_FIELDS = {
  id: true,
  programName: true,
  status: true,
  excelRowCount: true,
  excelSkuCount: true,
  excelDiscountType: true,
  excelValue: true,
  excelStartAt: true,
  excelEndAt: true,
  haravanId: true,
  haravanTakeType: true,
  haravanValue: true,
  haravanStartAt: true,
  haravanEndAt: true,
  haravanStatus: true,
  haravanVariantCount: true,
  haravanByProduct: true,
} as const

/**
 * Ordered so the rows that need attention come first: nothing on Haravan,
 * then duplicate names, then the extras, then everything that matched.
 */
const STATUS_RANK: Record<string, number> = {
  'not-found': 0,
  ambiguous: 1,
  'extra-on-haravan': 2,
  matched: 3,
}

export async function loadReconcileMatches(runId: string): Promise<ReconcileMatchRecord[]> {
  const rows = await prisma.reconcileMatch.findMany({
    where: { runId },
    select: MATCH_FIELDS,
  })
  // Sorted here rather than in SQL: the order is a fixed four-value ranking, and
  // encoding it as a CASE expression would be harder to read than this map.
  return rows.sort(
    (a, b) =>
      (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) ||
      a.programName.localeCompare(b.programName, 'vi'),
  )
}

export async function loadReconcileHistory(limit: number) {
  return prisma.checkRun.findMany({
    where: { mode: 'reconcile' },
    select: {
      id: true,
      fileName: true,
      createdAt: true,
      totalRows: true,
      totalPrograms: true,
      countCritical: true,
      countDanger: true,
      countWarn: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

/**
 * Runs that can be reconciled without re-uploading. A run whose file was pruned
 * is left out rather than listed and then refused - offering a choice that
 * cannot work is worse than not offering it.
 */
export async function loadReconcileSources(limit: number): Promise<ReconcileSourceOption[]> {
  return prisma.checkRun.findMany({
    where: { mode: 'check', storedFileName: { not: null } },
    select: {
      id: true,
      fileName: true,
      createdAt: true,
      totalRows: true,
      totalPrograms: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
