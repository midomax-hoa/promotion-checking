import type { HaravanClient } from './haravan-client'
import {
  PRODUCT_FIELDS,
  PRODUCTS_COUNT_PATH,
  PRODUCTS_PATH,
  type ProductCountResponse,
  type ProductListResponse,
} from './types'
import { latestUpdatedAt, rewindCursor } from './sync-cursor'
import type { CatalogStats, CatalogStore } from '@/lib/catalog/catalog-store'

/**
 * Walks `GET /com/products.json` and refreshes the catalog cache.
 *
 * Verified on the dev store: `limit` is clamped to 50 whatever we ask for, and
 * `page` returns disjoint slices (74 products = page 1 with 50 + page 2 with 24).
 *
 * Checking whether a SKU exists must read this cache, never one API call per
 * SKU: 3.929 individual calls take about 20 minutes and cannot tell a throttled
 * call apart from a missing SKU.
 */

export type SyncProgress = {
  page: number
  products: number
  variants: number
  /** Products Haravan reports it has, null on an incremental run. */
  expectedProducts: number | null
  done: boolean
}

export type SyncResult = {
  full: boolean
  pages: number
  products: number
  variants: number
  /** From `products/count.json`, so a short sync can be spotted. Null when incremental. */
  expectedProducts: number | null
  removed: number
  cursor: Date | null
  startedAt: Date
  finishedAt: Date
  stats: CatalogStats
}

export type SyncOptions = {
  full: boolean
  onProgress?: (progress: SyncProgress) => void
}

export type SyncDeps = {
  client: HaravanClient
  store: CatalogStore
  pageSize: number
  /** Rewinds the incremental cursor so a product edited mid-sync is not skipped forever. */
  cursorOverlapMs: number
  /** How many products a full run may come up short before it is treated as failed. */
  shortfallTolerance: number
}

/** Safety net against a misconfigured page size turning the loop into an infinite one. */
const MAX_PAGES = 2000

/** Thrown when the walk stops early, so the operator learns which page failed. */
export class CatalogSyncError extends Error {
  constructor(readonly page: number, options?: { cause?: unknown }) {
    super(`Đồng bộ danh mục dừng ở trang ${page}. Cache chưa đầy đủ.`, options)
    this.name = 'CatalogSyncError'
  }
}

export async function syncCatalog(options: SyncOptions, deps: SyncDeps): Promise<SyncResult> {
  const { client, store, pageSize, cursorOverlapMs, shortfallTolerance } = deps
  const startedAt = new Date()
  const previous = await store.readSyncState()

  // An incremental run only asks for what changed since the last successful run.
  const since = options.full ? null : previous.lastCursor
  const baseQuery: Record<string, string | number> = { limit: pageSize, fields: PRODUCT_FIELDS }
  if (since) baseQuery.updated_at_min = since.toISOString()

  // A full run knows up front how many products it should end up with, which is
  // how a truncated sync gets noticed instead of quietly leaving gaps.
  const expectedProducts = options.full ? await readProductCount(client) : null

  const fetchPage = (page: number) =>
    client.get<ProductListResponse>(PRODUCTS_PATH, { ...baseQuery, page })

  let page = 1
  let products = 0
  let variants = 0
  let maxUpdatedAt: Date | null = null
  // Learned from the first page rather than trusted from the settings: Haravan
  // clamps `limit` to 50, so a larger configured page size would otherwise make
  // every full page look like the last one.
  let effectivePageSize = pageSize
  let pending = fetchPage(1)
  guard(pending)

  for (; page <= MAX_PAGES; page += 1) {
    let batch: ProductListResponse['products']
    try {
      batch = (await pending).products ?? []
    } catch (cause) {
      throw new CatalogSyncError(page, { cause })
    }

    if (page === 1) effectivePageSize = Math.min(pageSize, Math.max(batch.length, 1))
    const done = batch.length === 0 || batch.length < effectivePageSize

    // Start the next request before writing this page, so the database work
    // overlaps the network wait instead of adding to it.
    const next = done ? null : fetchPage(page + 1)
    if (next) guard(next)

    if (batch.length > 0) {
      const saved = await store.savePage(batch, startedAt)
      products += saved.products
      variants += saved.variants
      maxUpdatedAt = latestUpdatedAt(batch, maxUpdatedAt)
    }

    options.onProgress?.({ page, products, variants, expectedProducts, done })
    if (done || !next) break
    pending = next
  }

  if (page > MAX_PAGES) throw new CatalogSyncError(MAX_PAGES)

  // A short full run must not stamp success: the cleanup below would then delete
  // everything it failed to fetch and the screen would still look healthy.
  if (expectedProducts !== null && products < expectedProducts - shortfallTolerance) {
    throw new CatalogSyncError(page, {
      cause: new Error(
        `Haravan báo có ${expectedProducts} sản phẩm nhưng chỉ kéo về được ${products}.`,
      ),
    })
  }

  // Products deleted on Haravan simply stop coming back, so a full run clears
  // whatever it did not touch. An incremental run cannot tell the difference.
  const removed = options.full ? await store.deleteStale(startedAt) : 0

  const stats = await store.readStats()
  const finishedAt = new Date()
  const cursor = rewindCursor(maxUpdatedAt, cursorOverlapMs) ?? previous.lastCursor

  await store.saveSyncState({
    ...stats,
    lastCursor: cursor,
    ...(options.full ? { lastFullSyncAt: finishedAt } : {}),
  })

  return {
    full: options.full,
    pages: page,
    products,
    variants,
    expectedProducts,
    removed,
    cursor,
    startedAt,
    finishedAt,
    stats,
  }
}

/** Keeps a prefetch from raising an unhandled rejection while a page is written. */
function guard(promise: Promise<unknown>): void {
  promise.catch(() => undefined)
}

/** A missing count must not abort the sync, it is only a cross-check. */
async function readProductCount(client: HaravanClient): Promise<number | null> {
  try {
    const response = await client.get<ProductCountResponse>(PRODUCTS_COUNT_PATH)
    return Number.isFinite(response.count) ? response.count : null
  } catch {
    return null
  }
}

