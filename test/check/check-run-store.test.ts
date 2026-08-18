/**
 * The pure half of persistence: turning an engine result into database rows.
 *
 * The behaviour worth protecting is that a clean program still gets a row. If
 * only programs with findings were stored, the result screen could never say
 * "this one is fine", and a file would look emptier than it is.
 */

import { describe, expect, it } from 'vitest'
import { buildFindingRows, buildProgramRows } from '@/lib/check/check-run-store'
import type { RunRulesResult } from '@/lib/rules/engine'
import type { PromotionProgram, PromotionRow, WorkbookReadResult } from '@/lib/excel/types'

function makeRow(rowNumber: number, programName: string): PromotionRow {
  return {
    sheetName: 'Key',
    rowNumber,
    productCode: null,
    sku: null,
    skuNormalized: null,
    productName: null,
    variantName: null,
    unit: null,
    listPrice: null,
    usageLimit: null,
    priceAfter: null,
    discountAmount: null,
    discountPercent: null,
    discountTypeRaw: null,
    discountType: null,
    startAt: null,
    endAt: null,
    programName,
    issues: {},
  }
}

function makeProgram(name: string, rowCount: number): PromotionProgram {
  return {
    name,
    rows: Array.from({ length: rowCount }, (_, index) => makeRow(index + 2, name)),
    sheetNames: ['Key'],
    distinctDiscountTypes: [],
    distinctAmounts: [],
    distinctPercents: [],
    distinctStarts: [],
    distinctEnds: [],
    distinctUsageLimits: [],
  }
}

const WORKBOOK = {
  fileName: 'promotion.xlsx',
  fileHash: 'hash',
  sheets: [],
  rows: [],
  programs: [makeProgram('BROKEN', 3), makeProgram('CLEAN', 5)],
  missingRequiredColumns: [],
} satisfies WorkbookReadResult

const RESULT: RunRulesResult = {
  counts: { critical: 2, danger: 1, warn: 0 },
  skippedRules: [],
  findings: [
    { ruleCode: 'C2', severity: 'critical', programName: 'BROKEN', rowNumber: 15, message: 'a' },
    {
      ruleCode: 'C2',
      severity: 'critical',
      programName: 'BROKEN',
      rowNumber: 16,
      message: 'b',
      suggestion: 'sửa cột Số tiền giảm',
    },
    { ruleCode: 'A1', severity: 'danger', message: 'thiếu cột' },
  ],
}

describe('turning findings into rows', () => {
  it('writes absent optional fields as null rather than leaving them out', () => {
    const rows = buildFindingRows(RESULT)
    expect(rows[0]).toEqual({
      ruleCode: 'C2',
      severity: 'critical',
      sheetName: null,
      rowNumber: 15,
      programName: 'BROKEN',
      sku: null,
      message: 'a',
      suggestion: null,
    })
  })

  it('keeps a suggestion when the rule gave one', () => {
    expect(buildFindingRows(RESULT)[1].suggestion).toBe('sửa cột Số tiền giảm')
  })

  it('keeps file-level findings, which belong to no program', () => {
    const fileLevel = buildFindingRows(RESULT).filter((row) => row.programName === null)
    expect(fileLevel).toHaveLength(1)
    expect(fileLevel[0].ruleCode).toBe('A1')
  })
})

describe('turning programs into rows', () => {
  const rows = buildProgramRows(WORKBOOK, RESULT)

  it('stores every program in the file, clean ones included', () => {
    expect(rows.map((row) => row.name)).toEqual(['BROKEN', 'CLEAN'])
  })

  it('records the row count from the file, not from the findings', () => {
    expect(rows.find((row) => row.name === 'CLEAN')).toMatchObject({ rowCount: 5 })
    expect(rows.find((row) => row.name === 'BROKEN')).toMatchObject({ rowCount: 3 })
  })

  it('counts findings per severity for the program they name', () => {
    expect(rows.find((row) => row.name === 'BROKEN')).toMatchObject({
      countCritical: 2,
      countDanger: 0,
      countWarn: 0,
    })
  })

  it('leaves a clean program on zero', () => {
    expect(rows.find((row) => row.name === 'CLEAN')).toMatchObject({
      countCritical: 0,
      countDanger: 0,
      countWarn: 0,
    })
  })

  it('does not attribute a file-level finding to any program', () => {
    const total = rows.reduce((sum, row) => sum + row.countCritical + row.countDanger, 0)
    expect(total).toBe(2)
  })
})
