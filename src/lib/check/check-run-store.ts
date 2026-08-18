/**
 * Writes one completed check into `CheckRun` + `CheckProgram` + `Finding`.
 *
 * A real file produces thousands of findings, so rows go down in batches inside
 * one transaction: either the whole run is readable or none of it is. A partly
 * written run is the worst outcome available here - it looks like a clean file.
 *
 * The row-building half is pure and exported on its own, so the mapping can be
 * tested without a database.
 */

import { prisma } from '@/lib/db/prisma'
import type { RunRulesResult } from '@/lib/rules/engine'
import type { Severity } from '@/lib/rules/types'
import type { WorkbookReadResult } from '@/lib/excel/types'

/** Big enough to keep the round trips down, small enough to stay inside the parameter limit. */
const FINDING_BATCH_SIZE = 1000

export type CheckRunInput = {
  workbook: WorkbookReadResult
  result: RunRulesResult
  catalogSyncedAt: Date | null
  /** null when the upload could not be kept; the export screen explains it. */
  storedFileName: string | null
  mode?: 'check' | 'reconcile'
}

export type FindingRow = {
  ruleCode: string
  severity: string
  sheetName: string | null
  rowNumber: number | null
  programName: string | null
  sku: string | null
  message: string
  suggestion: string | null
}

export type ProgramRow = {
  name: string
  rowCount: number
  countCritical: number
  countDanger: number
  countWarn: number
}

export function buildFindingRows(result: RunRulesResult): FindingRow[] {
  return result.findings.map((finding) => ({
    ruleCode: finding.ruleCode,
    severity: finding.severity,
    sheetName: finding.sheetName ?? null,
    rowNumber: finding.rowNumber ?? null,
    programName: finding.programName ?? null,
    sku: finding.sku ?? null,
    message: finding.message,
    suggestion: finding.suggestion ?? null,
  }))
}

/**
 * Every program in the file, clean ones included - the result screen has to be
 * able to say "this one is fine" rather than just omitting it.
 */
export function buildProgramRows(
  workbook: WorkbookReadResult,
  result: RunRulesResult,
): ProgramRow[] {
  const counts = new Map<string, Record<Severity, number>>()
  for (const finding of result.findings) {
    if (!finding.programName) continue
    const bucket = counts.get(finding.programName) ?? { critical: 0, danger: 0, warn: 0 }
    bucket[finding.severity] += 1
    counts.set(finding.programName, bucket)
  }

  return workbook.programs.map((program) => {
    const bucket = counts.get(program.name) ?? { critical: 0, danger: 0, warn: 0 }
    return {
      name: program.name,
      rowCount: program.rows.length,
      countCritical: bucket.critical,
      countDanger: bucket.danger,
      countWarn: bucket.warn,
    }
  })
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size))
  }
  return batches
}

export async function saveCheckRun(input: CheckRunInput): Promise<string> {
  const { workbook, result, catalogSyncedAt, storedFileName, mode = 'check' } = input
  const findingRows = buildFindingRows(result)
  const programRows = buildProgramRows(workbook, result)

  return prisma.$transaction(
    async (tx) => {
      const run = await tx.checkRun.create({
        data: {
          mode,
          fileName: workbook.fileName,
          storedFileName,
          fileHash: workbook.fileHash,
          totalSheets: workbook.sheets.length,
          totalRows: workbook.rows.length,
          totalPrograms: workbook.programs.length,
          countCritical: result.counts.critical,
          countDanger: result.counts.danger,
          countWarn: result.counts.warn,
          catalogSyncedAt,
        },
        select: { id: true },
      })

      if (programRows.length > 0) {
        await tx.checkProgram.createMany({
          data: programRows.map((row) => ({ ...row, runId: run.id })),
        })
      }
      for (const batch of chunk(findingRows, FINDING_BATCH_SIZE)) {
        await tx.finding.createMany({ data: batch.map((row) => ({ ...row, runId: run.id })) })
      }

      return run.id
    },
    // A 4.000 row file writes thousands of findings; the 5 s default would abort
    // a run that is merely large rather than stuck.
    { maxWait: 10_000, timeout: 60_000 },
  )
}

/** Set once the bytes are safely on disk, so a failed write leaves the column null. */
export async function attachStoredFile(runId: string, storedFileName: string): Promise<void> {
  await prisma.checkRun.update({ where: { id: runId }, data: { storedFileName } })
}
