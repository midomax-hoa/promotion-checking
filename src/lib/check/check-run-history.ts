/**
 * The history list.
 *
 * Separate from `finding-queries.ts` because it answers a different question:
 * that file is about one run's findings, this one is about which runs exist.
 * Only `mode: 'check'` runs appear - reconciliation runs (phase 06) have their
 * own screen and would otherwise be mixed in with no way to tell them apart.
 */

import { prisma } from '@/lib/db/prisma'

export type HistoryEntry = {
  id: string
  fileName: string
  createdAt: Date
  totalSheets: number
  totalRows: number
  totalPrograms: number
  countCritical: number
  countDanger: number
  countWarn: number
}

export async function loadHistory(limit: number): Promise<HistoryEntry[]> {
  return prisma.checkRun.findMany({
    where: { mode: 'check' },
    select: {
      id: true,
      fileName: true,
      createdAt: true,
      totalSheets: true,
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
