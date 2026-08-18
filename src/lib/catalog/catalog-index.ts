import { prisma } from '@/lib/db/prisma'
import { displaySku, normalizeSku } from './sku'

/**
 * In-memory SKU lookup built from the catalog cache.
 *
 * Rule B1 checks thousands of SKUs per file, so the whole cache is loaded once
 * and indexed into a Map. `bySku` holds an array because Haravan allows the same
 * SKU on several variants - rule B5 reports those.
 */

export type CatalogEntry = {
  variantId: bigint
  productId: bigint
  /** Original spelling, for display. The Map key is the normalised form. */
  sku: string
  productTitle: string
  variantTitle: string | null
  price: number
  publishedAt: Date | null
  notAllowPromotion: boolean
}

export type CatalogIndex = {
  bySku: Map<string, CatalogEntry[]>
  /**
   * Variant id -> entry, keyed by the id as text so it survives JSON and never
   * depends on BigInt key equality. SKU-bearing variants only, like `bySku`.
   *
   * Exists for reconciliation: a Haravan promotion names the variants it covers
   * by id, and turning those back into SKUs is what lets group F compare the two
   * sides at all.
   */
  byVariantId: Map<string, CatalogEntry>
  /** Product id -> its SKU-bearing variants. A promotion may attach whole products. */
  byProductId: Map<string, CatalogEntry[]>
  /**
   * Product id -> how many variants it has in total, blank-SKU ones included.
   *
   * Separate from `byProductId` on purpose. Attaching a product to a promotion
   * attaches every one of its variants, whether or not it carries a SKU, so
   * counting only the SKU-bearing ones would under-report and make rule F5
   * accuse a correct import of losing rows.
   */
  variantCountByProductId: Map<string, number>
  /** Normalised SKUs, used to suggest a near match for a typo. */
  allSkus: string[]
  syncedAt: Date | null
  variantCount: number
  blankSkuCount: number
}

type CatalogRow = {
  variantId: bigint
  productId: bigint
  sku: string | null
  productTitle: string
  variantTitle: string | null
  price: number
  publishedAt: Date | null
  notAllowPromotion: boolean
}

/** Short enough that a fresh sync shows up quickly, long enough to help one check run. */
const CACHE_TTL_MS = 60_000

let cached: { index: CatalogIndex; expiresAt: number } | null = null

/** Pure builder, so the grouping rules can be tested without a database. */
export function buildCatalogIndex(rows: CatalogRow[], syncedAt: Date | null): CatalogIndex {
  const bySku = new Map<string, CatalogEntry[]>()
  const byVariantId = new Map<string, CatalogEntry>()
  const byProductId = new Map<string, CatalogEntry[]>()
  const variantCountByProductId = new Map<string, number>()
  let blankSkuCount = 0

  for (const row of rows) {
    const productKey = row.productId.toString()
    // Counted before the blank-SKU check: attaching a product attaches all of
    // its variants, so this total must include the ones without a SKU.
    variantCountByProductId.set(productKey, (variantCountByProductId.get(productKey) ?? 0) + 1)

    const key = normalizeSku(row.sku)
    const display = displaySku(row.sku)
    if (key === null || display === null) {
      // A blank SKU can never be looked up; counted so screen 3 can show it.
      blankSkuCount += 1
      continue
    }
    const entry: CatalogEntry = {
      variantId: row.variantId,
      productId: row.productId,
      sku: display,
      productTitle: row.productTitle,
      variantTitle: row.variantTitle,
      price: row.price,
      publishedAt: row.publishedAt,
      notAllowPromotion: row.notAllowPromotion,
    }
    const bucket = bySku.get(key)
    if (bucket) bucket.push(entry)
    else bySku.set(key, [entry])

    byVariantId.set(entry.variantId.toString(), entry)
    const productBucket = byProductId.get(productKey)
    if (productBucket) productBucket.push(entry)
    else byProductId.set(productKey, [entry])
  }

  return {
    bySku,
    byVariantId,
    byProductId,
    variantCountByProductId,
    allSkus: [...bySku.keys()],
    syncedAt,
    variantCount: rows.length,
    blankSkuCount,
  }
}

export async function loadCatalogIndex(
  options: { force?: boolean; now?: number } = {},
): Promise<CatalogIndex> {
  const now = options.now ?? Date.now()
  if (!options.force && cached && cached.expiresAt > now) return cached.index

  const [rows, state] = await Promise.all([
    prisma.variantCache.findMany({
      select: {
        variantId: true,
        productId: true,
        sku: true,
        productTitle: true,
        variantTitle: true,
        price: true,
        publishedAt: true,
        notAllowPromotion: true,
      },
    }),
    prisma.syncState.findUnique({ where: { id: 1 } }),
  ])

  const index = buildCatalogIndex(rows, state?.lastFullSyncAt ?? null)
  cached = { index, expiresAt: now + CACHE_TTL_MS }
  return index
}

/** Called right after a sync so the next lookup does not serve the old catalog. */
export function clearCatalogIndexCache(): void {
  cached = null
}

/** Looks a SKU up through the shared normalisation rule. Blank never matches. */
export function findBySku(index: CatalogIndex, rawSku: string | null | undefined): CatalogEntry[] {
  const key = normalizeSku(rawSku)
  if (key === null) return []
  return index.bySku.get(key) ?? []
}
