import { prisma } from '@/lib/db/prisma'
import { displaySku } from './sku'
import type { HaravanProduct } from '@/lib/haravan/types'

/**
 * Persistence for the catalog cache.
 *
 * Split out of `catalog-sync` so the paging logic can be unit tested against a
 * fake store without a live database.
 *
 * Writing strategy: one page = delete then insert, inside a transaction. That is
 * two statements per page instead of one upsert per variant, which is what keeps
 * a 3.000 product sync inside the 30 second budget. Deleting by productId also
 * removes variants that disappeared from a product.
 */

export type CatalogStats = {
  productCount: number
  variantCount: number
  blankSkuCount: number
  duplicateSkuCount: number
}

export type SyncStateSnapshot = {
  lastFullSyncAt: Date | null
  lastCursor: Date | null
} & CatalogStats

export type SyncStatePatch = Partial<SyncStateSnapshot>

export type CatalogStore = {
  savePage(products: HaravanProduct[], syncedAt: Date): Promise<{ products: number; variants: number }>
  deleteStale(before: Date): Promise<number>
  readStats(): Promise<CatalogStats>
  readSyncState(): Promise<SyncStateSnapshot>
  saveSyncState(patch: SyncStatePatch): Promise<void>
}

const SYNC_STATE_ID = 1

export const prismaCatalogStore: CatalogStore = {
  async savePage(products, syncedAt) {
    const rows = products.flatMap((product) => toVariantRows(product, syncedAt))
    if (rows.length === 0) return { products: products.length, variants: 0 }

    const productIds = products.map((product) => BigInt(product.id))
    const variantIds = rows.map((row) => row.variantId)

    await prisma.$transaction([
      // Both branches matter: the productId sweep drops variants that were
      // removed from a product, the variantId sweep covers a variant that moved
      // to a different product between two syncs.
      prisma.variantCache.deleteMany({
        where: { OR: [{ productId: { in: productIds } }, { variantId: { in: variantIds } }] },
      }),
      prisma.variantCache.createMany({ data: rows }),
    ])

    return { products: products.length, variants: rows.length }
  },

  async deleteStale(before) {
    const result = await prisma.variantCache.deleteMany({ where: { syncedAt: { lt: before } } })
    return result.count
  },

  async readStats() {
    const [row] = await prisma.$queryRaw<
      { variants: number; products: number; blank: number; duplicates: number }[]
    >`
      SELECT
        COUNT(*)::int AS variants,
        COUNT(DISTINCT "productId")::int AS products,
        COUNT(*) FILTER (WHERE "sku" IS NULL)::int AS blank,
        (
          SELECT COUNT(*)::int FROM (
            SELECT lower("sku") FROM "VariantCache"
            WHERE "sku" IS NOT NULL
            GROUP BY lower("sku") HAVING COUNT(*) > 1
          ) AS d
        ) AS duplicates
      FROM "VariantCache"
    `
    return {
      variantCount: row?.variants ?? 0,
      productCount: row?.products ?? 0,
      blankSkuCount: row?.blank ?? 0,
      duplicateSkuCount: row?.duplicates ?? 0,
    }
  },

  async readSyncState() {
    const state = await prisma.syncState.findUnique({ where: { id: SYNC_STATE_ID } })
    return {
      lastFullSyncAt: state?.lastFullSyncAt ?? null,
      lastCursor: state?.lastCursor ?? null,
      productCount: state?.productCount ?? 0,
      variantCount: state?.variantCount ?? 0,
      blankSkuCount: state?.blankSkuCount ?? 0,
      duplicateSkuCount: state?.duplicateSkuCount ?? 0,
    }
  },

  async saveSyncState(patch) {
    await prisma.syncState.upsert({
      where: { id: SYNC_STATE_ID },
      create: { id: SYNC_STATE_ID, ...patch },
      update: patch,
    })
  },
}

/**
 * Flattens a product into cache rows.
 *
 * A blank SKU is stored as null so "no usable SKU" is a single condition in the
 * database instead of a mix of null and whitespace.
 */
export function toVariantRows(product: HaravanProduct, syncedAt: Date) {
  return product.variants.map((variant) => ({
    variantId: BigInt(variant.id),
    productId: BigInt(product.id),
    sku: displaySku(variant.sku),
    barcode: variant.barcode ?? null,
    productTitle: product.title,
    variantTitle: variant.title ?? null,
    price: variant.price ?? 0,
    compareAtPrice: variant.compare_at_price ?? null,
    inventoryQty: variant.inventory_quantity ?? null,
    publishedAt: product.published_at ? new Date(product.published_at) : null,
    notAllowPromotion: product.not_allow_promotion ?? false,
    publishedScope: product.published_scope ?? null,
    syncedAt,
  }))
}
