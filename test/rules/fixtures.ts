/**
 * Builders for rule tests: a row, a workbook and a catalog, each with sane
 * defaults so a test only states the field it is actually about.
 */

import { buildCatalogIndex, type CatalogIndex } from '@/lib/catalog/catalog-index'
import { groupPrograms } from '@/lib/excel/program-grouper'
import type { PromotionRow, SheetSummary, WorkbookReadResult } from '@/lib/excel/types'
import { runRules, type EngineFinding } from '@/lib/rules/engine'
import { mergeRuleConfigs } from '@/lib/rules/rule-config-store'
import type { HaravanPromotion, Rule } from '@/lib/rules/types'

let nextRowNumber = 2

export function makeRow(overrides: Partial<PromotionRow> = {}): PromotionRow {
  const rowNumber = overrides.rowNumber ?? nextRowNumber++
  const sku = overrides.sku ?? `SKU${rowNumber}`
  return {
    sheetName: 'Key',
    rowNumber,
    productCode: 'SKU',
    sku,
    skuNormalized: sku.trim().toLowerCase(),
    productName: 'Áo thun',
    variantName: null,
    unit: 'Chiếc',
    listPrice: 100_000,
    usageLimit: null,
    priceAfter: 90_000,
    discountAmount: 10_000,
    discountPercent: null,
    discountTypeRaw: 'Giảm giá theo số tiền',
    discountType: 'fixed_amount',
    startAt: new Date(2026, 7, 1),
    endAt: new Date(2026, 7, 31),
    programName: '2608GST10K',
    issues: {},
    ...overrides,
  }
}

export function makeSheet(overrides: Partial<SheetSummary> = {}): SheetSummary {
  return {
    name: 'Key',
    rowCount: 1,
    mappedColumns: {},
    blankRowNumbers: [],
    ...overrides,
  }
}

export function makeWorkbook(
  rows: PromotionRow[],
  overrides: Partial<WorkbookReadResult> = {},
): WorkbookReadResult {
  const sheetNames = [...new Set(rows.map((row) => row.sheetName))]
  return {
    fileName: 'test.xlsx',
    fileHash: 'hash',
    sheets: sheetNames.map((name) =>
      makeSheet({ name, rowCount: rows.filter((row) => row.sheetName === name).length }),
    ),
    rows,
    programs: groupPrograms(rows),
    missingRequiredColumns: [],
    ...overrides,
  }
}

type CatalogVariant = {
  sku: string | null
  price?: number
  publishedAt?: Date | null
  notAllowPromotion?: boolean
  productTitle?: string
  variantTitle?: string | null
}

export function makeCatalog(
  variants: CatalogVariant[],
  syncedAt: Date | null = new Date(2026, 7, 18),
): CatalogIndex {
  return buildCatalogIndex(
    variants.map((variant, index) => ({
      variantId: BigInt(index + 1),
      productId: BigInt(index + 1),
      sku: variant.sku,
      productTitle: variant.productTitle ?? 'Áo thun',
      variantTitle: variant.variantTitle ?? null,
      price: variant.price ?? 100_000,
      publishedAt: variant.publishedAt === undefined ? new Date(2026, 0, 1) : variant.publishedAt,
      notAllowPromotion: variant.notAllowPromotion ?? false,
    })),
    syncedAt,
  )
}

export const EMPTY_CATALOG: CatalogIndex = makeCatalog([], null)

export function makePromotion(overrides: Partial<HaravanPromotion> = {}): HaravanPromotion {
  return {
    id: '1',
    name: 'Chương trình cũ',
    startAt: new Date(2026, 7, 1),
    endAt: new Date(2026, 7, 31),
    active: true,
    skus: [],
    ...overrides,
  }
}

/** Runs one rule with the catalog defaults for its params. */
export function runRule(
  rule: Rule,
  options: {
    rows?: PromotionRow[]
    workbook?: WorkbookReadResult
    catalog?: CatalogIndex
    haravanPromotions?: HaravanPromotion[] | null
    now?: Date
    params?: Record<string, number | string | boolean>
    /** D1 and D2 ship disabled; a test of those has to turn them on. */
    enabled?: boolean
  } = {},
): EngineFinding[] {
  const configs = mergeRuleConfigs([]).map((config) =>
    config.code === rule.code
      ? {
          ...config,
          enabled: options.enabled ?? config.enabled,
          params: { ...config.params, ...options.params },
        }
      : config,
  )

  return runRules({
    workbook: options.workbook ?? makeWorkbook(options.rows ?? [makeRow()]),
    catalog: options.catalog ?? makeCatalog([{ sku: 'SKU2' }]),
    haravanPromotions: options.haravanPromotions ?? null,
    now: options.now ?? new Date(2026, 7, 18),
    moneyToleranceVnd: 0.5,
    configs,
    rules: [rule],
  }).findings
}
