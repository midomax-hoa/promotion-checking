import { describe, expect, it } from 'vitest'
import { buildDiff } from '@/lib/reconcile/match-diff'
import { buildReconcileMatchRows } from '@/lib/reconcile/reconcile-match-rows'
import { matchPrograms } from '@/lib/reconcile/promotion-matcher'
import type { ReconcileMatchRecord } from '@/lib/reconcile/reconcile-queries'
import { makeRow, makeWorkbook } from '../rules/fixtures'
import { makeReconcilePromotion, TWO_VARIANT_CATALOG, VN_OFFSET_MINUTES } from './fixtures'

const OPTIONS = {
  shopTimezoneOffsetMinutes: VN_OFFSET_MINUTES,
  moneyToleranceVnd: 0.5,
  percentTolerance: 0.01,
}

/** Builds the persisted row the result screen reads, going through the real path. */
function storedRow(
  rowOverrides: Parameters<typeof makeRow>[0][],
  raw: Parameters<typeof makeReconcilePromotion>[0][],
): ReconcileMatchRecord {
  const workbook = makeWorkbook(rowOverrides.map((overrides) => makeRow(overrides)))
  const matches = matchPrograms(
    workbook,
    raw.map((entry) => makeReconcilePromotion(entry)),
    { shopTimezoneOffsetMinutes: VN_OFFSET_MINUTES },
  )
  return { id: 'row-1', ...buildReconcileMatchRows(matches)[0] }
}

function field(row: ReconcileMatchRecord, label: string) {
  const found = buildDiff(row, OPTIONS).find((entry) => entry.label === label)
  if (found == null) throw new Error(`Không có mục "${label}"`)
  return found
}

describe('buildDiff', () => {
  it('shows both sides agreeing, and marks nothing', () => {
    const row = storedRow([{ programName: 'X', sku: 'SKU1' }], [{ name: 'X', entitled_variant_ids: [1] }])
    expect(buildDiff(row, OPTIONS).every((entry) => !entry.differs)).toBe(true)
    expect(field(row, 'Giá trị giảm').haravan).toBe('10.000đ')
  })

  it('marks a differing discount', () => {
    const row = storedRow([{ programName: 'X' }], [{ name: 'X', value: 20_000 }])
    const discount = field(row, 'Giá trị giảm')
    expect(discount.excel).toBe('10.000đ')
    expect(discount.haravan).toBe('20.000đ')
    expect(discount.differs).toBe(true)
  })

  it('does not mark the UTC+7 conversion as a difference', () => {
    const row = storedRow(
      [{ programName: 'X', startAt: new Date(2020, 0, 1), endAt: null }],
      [{ name: 'X', starts_at: '2019-12-31T17:00:00Z', ends_at: null }],
    )
    const start = field(row, 'Ngày bắt đầu')
    expect(start.excel).toBe('01/01/2020')
    expect(start.haravan).toBe('01/01/2020')
    expect(start.differs).toBe(false)
  })

  it('leaves the Haravan column empty for a program that is not there', () => {
    const row = storedRow([{ programName: 'Chưa import' }], [])
    expect(row.status).toBe('not-found')
    expect(field(row, 'Giá trị giảm').haravan).toBe('(không có)')
    // Nothing to compare against is not the same as a difference.
    expect(field(row, 'Giá trị giảm').differs).toBe(false)
  })

  it('says so when the attachment could not be resolved', () => {
    const row = storedRow(
      [{ programName: 'X', sku: 'SKU1' }],
      [{ name: 'X', entitled_variant_ids: [], entitled_product_ids: [] }],
    )
    const skus = field(row, 'Số mã hiệu')
    expect(skus.haravan).toBe('chưa tra được')
    expect(skus.differs).toBe(false)
  })

  it('marks a disabled promotion', () => {
    const row = storedRow([{ programName: 'X' }], [{ name: 'X', status: 'disabled' }])
    expect(field(row, 'Trạng thái').differs).toBe(true)
  })
})

describe('buildReconcileMatchRows', () => {
  it('writes one row per candidate when the name is duplicated', () => {
    const workbook = makeWorkbook([makeRow({ programName: 'X' })])
    const matches = matchPrograms(
      workbook,
      [makeReconcilePromotion({ id: 1, name: 'X' }), makeReconcilePromotion({ id: 2, name: 'X' })],
      { shopTimezoneOffsetMinutes: VN_OFFSET_MINUTES },
    )
    const rows = buildReconcileMatchRows(matches)

    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.haravanId)).toEqual(['1', '2'])
    expect(rows.every((row) => row.status === 'ambiguous')).toBe(true)
  })

  it('still writes a row when nothing matched', () => {
    const workbook = makeWorkbook([makeRow({ programName: 'Chưa import' })])
    const rows = buildReconcileMatchRows(
      matchPrograms(workbook, [], { shopTimezoneOffsetMinutes: VN_OFFSET_MINUTES }),
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].haravanId).toBeNull()
    expect(rows[0].excelRowCount).toBe(1)
  })

  it('snapshots the Excel side for a promotion only Haravan has', () => {
    const workbook = makeWorkbook([makeRow({ programName: 'X' })])
    const matches = matchPrograms(
      workbook,
      [makeReconcilePromotion({ name: 'X' }), makeReconcilePromotion({ id: 9, name: 'Tạo tay' })],
      { shopTimezoneOffsetMinutes: VN_OFFSET_MINUTES },
    )
    const extra = buildReconcileMatchRows(matches).find((row) => row.status === 'extra-on-haravan')

    expect(extra?.excelRowCount).toBeNull()
    expect(extra?.haravanId).toBe('9')
  })
})

/** The catalog is untouched by the diff, but the fixture keeps the import honest. */
describe('fixture sanity', () => {
  it('resolves both fixture variants', () => {
    expect(TWO_VARIANT_CATALOG.byVariantId.size).toBe(2)
  })
})
