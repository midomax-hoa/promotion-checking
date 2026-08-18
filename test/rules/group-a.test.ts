import { describe, expect, it } from 'vitest'
import { a1MissingRequiredColumns } from '@/lib/rules/group-a-file-structure/a1-missing-required-columns'
import { a2SheetInventory } from '@/lib/rules/group-a-file-structure/a2-sheet-inventory'
import { a3UnreadableDates } from '@/lib/rules/group-a-file-structure/a3-unreadable-dates'
import { a4BlankSku } from '@/lib/rules/group-a-file-structure/a4-blank-sku'
import { a5InterleavedBlankRows } from '@/lib/rules/group-a-file-structure/a5-interleaved-blank-rows'
import { makeRow, makeSheet, makeWorkbook, runRule } from './fixtures'

describe('A1 - missing required columns', () => {
  it('names the missing columns in Vietnamese and says the sheet was skipped', () => {
    const workbook = makeWorkbook([makeRow()], {
      missingRequiredColumns: [{ sheetName: 'Ghi chú', missing: ['sku', 'programName'] }],
    })
    const findings = runRule(a1MissingRequiredColumns, { workbook })

    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('Mã hiệu, Tên ctkm')
    expect(findings[0].message).toContain('đã bị bỏ qua')
    expect(findings[0].sheetName).toBe('Ghi chú')
  })

  it('says nothing when every sheet mapped', () => {
    expect(runRule(a1MissingRequiredColumns)).toHaveLength(0)
  })
})

describe('A2 - sheet inventory', () => {
  it('lists every sheet with its row count', () => {
    const workbook = makeWorkbook([makeRow()], {
      sheets: [
        makeSheet({ name: 'Key', rowCount: 3929 }),
        makeSheet({ name: 'Giảm phần trăm', rowCount: 2 }),
      ],
    })
    const findings = runRule(a2SheetInventory, { workbook })

    expect(findings.map((f) => f.sheetName)).toEqual(['Key', 'Giảm phần trăm'])
    expect(findings[0].message).toContain('3.929 dòng')
    expect(findings[1].message).toContain('2 dòng')
  })

  it('flags a sheet that was found but not read', () => {
    const workbook = makeWorkbook([makeRow()], {
      sheets: [makeSheet({ name: 'Ghi chú', rowCount: 4 })],
      missingRequiredColumns: [{ sheetName: 'Ghi chú', missing: ['sku'] }],
    })
    expect(runRule(a2SheetInventory, { workbook })[0].message).toContain('không được đọc')
  })
})

describe('A3 - unreadable dates', () => {
  it('separates an empty cell from an unreadable one', () => {
    const rows = [
      makeRow({ rowNumber: 5, startAt: null, issues: { startAt: 'missing' } }),
      makeRow({ rowNumber: 6, endAt: null, issues: { endAt: 'unparsable-date' } }),
    ]
    const findings = runRule(a3UnreadableDates, { rows })

    expect(findings).toHaveLength(2)
    expect(findings[0].message).toContain('"Thời gian bắt đầu" để trống')
    expect(findings[1].message).toContain('"Thời gian kết thúc" không đọc được')
    expect(findings[1].rowNumber).toBe(6)
  })

  it('stays silent on rows whose dates parsed', () => {
    expect(runRule(a3UnreadableDates)).toHaveLength(0)
  })
})

describe('A4 - blank SKU', () => {
  it('reports a row whose SKU cell holds only whitespace', () => {
    const rows = [makeRow({ rowNumber: 9, sku: '   ', skuNormalized: null })]
    const findings = runRule(a4BlankSku, { rows })

    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('sẽ bị bỏ qua khi import')
    expect(findings[0].rowNumber).toBe(9)
  })
})

describe('A5 - interleaved blank rows', () => {
  it('reports each blank row recorded by the reader', () => {
    const workbook = makeWorkbook([makeRow()], {
      sheets: [makeSheet({ name: 'Key', rowCount: 10, blankRowNumbers: [7, 8] })],
    })
    const findings = runRule(a5InterleavedBlankRows, { workbook })

    expect(findings.map((f) => f.rowNumber)).toEqual([7, 8])
    expect(findings[0].suggestion).toContain('dừng đọc ở dòng trống đầu tiên')
  })

  it('says nothing for a sheet with no gaps', () => {
    expect(runRule(a5InterleavedBlankRows)).toHaveLength(0)
  })
})
