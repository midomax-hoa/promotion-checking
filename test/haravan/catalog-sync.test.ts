import { describe, expect, it, vi } from 'vitest'
import { CatalogSyncError, syncCatalog, type SyncProgress } from '@/lib/haravan/catalog-sync'
import type { HaravanClient } from '@/lib/haravan/haravan-client'
import type { CatalogStats, CatalogStore, SyncStateSnapshot } from '@/lib/catalog/catalog-store'
import type { HaravanProduct } from '@/lib/haravan/types'

const PAGE_SIZE = 50

/** Deps every test shares; each case overrides only what it exercises. */
const BASE_DEPS = { pageSize: PAGE_SIZE, cursorOverlapMs: 0, shortfallTolerance: 0 }

const EMPTY_STATS: CatalogStats = {
  productCount: 0,
  variantCount: 0,
  blankSkuCount: 0,
  duplicateSkuCount: 0,
}

function product(id: number, updatedAt = '2026-08-10T00:00:00Z'): HaravanProduct {
  return {
    id,
    title: `Sản phẩm ${id}`,
    published_at: null,
    published_scope: 'global',
    not_allow_promotion: false,
    updated_at: updatedAt,
    variants: [
      {
        id: id * 10,
        product_id: id,
        sku: `SKU-${id}`,
        barcode: null,
        title: 'Mặc định',
        price: 1000,
        compare_at_price: null,
        inventory_quantity: 5,
      },
    ],
  }
}

function fakeStore(state: Partial<SyncStateSnapshot> = {}) {
  const saved: SyncStateSnapshot[] = []
  const pages: HaravanProduct[][] = []
  const store: CatalogStore = {
    savePage: vi.fn(async (products: HaravanProduct[]) => {
      pages.push(products)
      return { products: products.length, variants: products.flatMap((p) => p.variants).length }
    }),
    deleteStale: vi.fn(async () => 3),
    readStats: vi.fn(async () => ({ ...EMPTY_STATS, productCount: 2, variantCount: 2 })),
    readSyncState: vi.fn(async () => ({
      lastFullSyncAt: null,
      lastCursor: null,
      ...EMPTY_STATS,
      ...state,
    })),
    saveSyncState: vi.fn(async (patch) => {
      saved.push(patch as SyncStateSnapshot)
    }),
  }
  return { store, saved, pages }
}

/**
 * Serves canned pages and records the query of every call.
 * `count` defaults to the number of products actually served, matching a healthy shop.
 */
function fakeClient(
  pagesByNumber: HaravanProduct[][],
  options: { count?: number | null } = {},
) {
  const total = pagesByNumber.reduce((sum, page) => sum + page.length, 0)
  const count = options.count === undefined ? total : options.count
  const queries: Record<string, unknown>[] = []
  const client = {
    get: vi.fn(async (path: string, query?: Record<string, unknown>) => {
      queries.push({ path, ...query })
      if (path.endsWith('/count.json')) {
        if (count === null) throw new Error('không lấy được count')
        return { count }
      }
      const page = Number(query?.page ?? 1)
      return { products: pagesByNumber[page - 1] ?? [] }
    }),
  } as unknown as HaravanClient
  return { client, queries }
}

async function captureError(promise: Promise<unknown>): Promise<Error & { page?: number }> {
  try {
    await promise
    throw new Error('Lượt đồng bộ lẽ ra phải thất bại.')
  } catch (error) {
    return error as Error & { page?: number }
  }
}

describe('syncCatalog', () => {
  it('stops on the first page shorter than the page size', async () => {
    const fullPage = Array.from({ length: PAGE_SIZE }, (_, i) => product(i + 1))
    const shortPage = [product(101), product(102)]
    const { client, queries } = fakeClient([fullPage, shortPage])
    const { store } = fakeStore()

    const result = await syncCatalog({ full: true }, { client, store, ...BASE_DEPS })

    expect(result.pages).toBe(2)
    expect(result.products).toBe(52)
    expect(result.variants).toBe(52)
    // count.json plus exactly two product pages - no wasted third call.
    expect(queries.filter((q) => q.path === '/com/products.json')).toHaveLength(2)
  })

  it('treats an empty first page as a finished sync', async () => {
    const { client } = fakeClient([[]])
    const { store } = fakeStore()

    const result = await syncCatalog({ full: true }, { client, store, ...BASE_DEPS })

    expect(result.pages).toBe(1)
    expect(result.products).toBe(0)
    expect(store.savePage).not.toHaveBeenCalled()
  })

  it('reports progress for every page', async () => {
    const fullPage = Array.from({ length: PAGE_SIZE }, (_, i) => product(i + 1))
    const { client } = fakeClient([fullPage, [product(200)]])
    const { store } = fakeStore()
    const seen: { page: number; done: boolean }[] = []

    await syncCatalog(
      { full: true, onProgress: (p: SyncProgress) => seen.push({ page: p.page, done: p.done }) },
      { client, store, ...BASE_DEPS },
    )

    expect(seen).toEqual([
      { page: 1, done: false },
      { page: 2, done: true },
    ])
  })

  it('a full run clears rows it did not touch and stamps lastFullSyncAt', async () => {
    const { client } = fakeClient([[product(1)]])
    const { store, saved } = fakeStore()

    const result = await syncCatalog({ full: true }, { client, store, ...BASE_DEPS })

    expect(store.deleteStale).toHaveBeenCalledOnce()
    expect(result.removed).toBe(3)
    expect(saved[0].lastFullSyncAt).toBeInstanceOf(Date)
    expect(result.expectedProducts).toBe(1)
  })

  it('keeps paging when the configured page size is bigger than what Haravan returns', async () => {
    // Haravan clamps `limit` to 50. With pageSize 100 a naive "shorter than the
    // page size" test would stop after page 1 and then delete the rest of the cache.
    const fullPage = Array.from({ length: 50 }, (_, i) => product(i + 1))
    const tail = Array.from({ length: 24 }, (_, i) => product(i + 100))
    const { client, queries } = fakeClient([fullPage, tail])
    const { store } = fakeStore()

    const result = await syncCatalog(
      { full: true },
      { client, store, ...BASE_DEPS, pageSize: 100 },
    )

    expect(result.products).toBe(74)
    expect(queries.filter((q) => q.path === '/com/products.json')).toHaveLength(2)
    expect(store.deleteStale).toHaveBeenCalledOnce()
  })

  it('refuses to finish a full run that came up short of products/count.json', async () => {
    const { client } = fakeClient([[product(1)]], { count: 74 })
    const { store } = fakeStore()

    const error = await captureError(
      syncCatalog({ full: true }, { client, store, ...BASE_DEPS }),
    )

    expect(error).toBeInstanceOf(CatalogSyncError)
    expect((error.cause as Error).message).toContain('74')
    // Nothing may be deleted or stamped: the cache is still the good one.
    expect(store.deleteStale).not.toHaveBeenCalled()
    expect(store.saveSyncState).not.toHaveBeenCalled()
  })

  it('accepts a shortfall inside the configured tolerance', async () => {
    const { client } = fakeClient([[product(1), product(2)]], { count: 3 })
    const { store } = fakeStore()

    const result = await syncCatalog(
      { full: true },
      { client, store, ...BASE_DEPS, shortfallTolerance: 1 },
    )

    expect(result.products).toBe(2)
    expect(store.deleteStale).toHaveBeenCalledOnce()
  })

  it('rewinds the cursor by the configured overlap', async () => {
    // A product edited while an earlier page was already fetched would otherwise
    // sit below the new cursor and never be picked up again.
    const { client } = fakeClient([[product(1, '2026-08-13T08:00:00.000Z')]])
    const { store } = fakeStore()

    const result = await syncCatalog(
      { full: false },
      { client, store, ...BASE_DEPS, cursorOverlapMs: 300_000 },
    )

    expect(result.cursor?.toISOString()).toBe('2026-08-13T07:55:00.000Z')
  })

  it('an incremental run filters by the stored cursor and keeps stale rows', async () => {
    const cursor = new Date('2026-08-01T00:00:00Z')
    const { client, queries } = fakeClient([[product(1, '2026-08-13T08:06:44.595Z')]])
    const { store, saved } = fakeStore({ lastCursor: cursor })

    const result = await syncCatalog({ full: false }, { client, store, ...BASE_DEPS })

    expect(queries[0].updated_at_min).toBe(cursor.toISOString())
    expect(store.deleteStale).not.toHaveBeenCalled()
    expect(saved[0].lastFullSyncAt).toBeUndefined()
    // The cursor moves to the newest product seen, so the next run picks up there.
    expect(result.cursor?.toISOString()).toBe('2026-08-13T08:06:44.595Z')
    // No count.json call on an incremental run: the shop total means nothing here.
    expect(result.expectedProducts).toBeNull()
  })

  it('keeps the old cursor when an incremental run finds nothing', async () => {
    const cursor = new Date('2026-08-01T00:00:00Z')
    const { client } = fakeClient([[]])
    const { store } = fakeStore({ lastCursor: cursor })

    const result = await syncCatalog({ full: false }, { client, store, ...BASE_DEPS })

    expect(result.cursor?.toISOString()).toBe(cursor.toISOString())
  })

  it('names the page it stopped on and leaves lastFullSyncAt alone', async () => {
    const fullPage = Array.from({ length: PAGE_SIZE }, (_, i) => product(i + 1))
    const client = {
      get: vi.fn(async (path: string, query?: Record<string, unknown>) => {
        if (path.endsWith('/count.json')) return { count: 74 }
        if (Number(query?.page) === 2) throw new Error('429 mãi không hết')
        return { products: fullPage }
      }),
    } as unknown as HaravanClient
    const { store } = fakeStore()

    const error = await captureError(syncCatalog({ full: true }, { client, store, ...BASE_DEPS }))

    expect(error).toBeInstanceOf(CatalogSyncError)
    expect(error.page).toBe(2)
    expect(store.saveSyncState).not.toHaveBeenCalled()
    expect(store.deleteStale).not.toHaveBeenCalled()
  })

  it('survives a missing product count instead of aborting the sync', async () => {
    const { client } = fakeClient([[product(1)]], { count: null })
    const { store } = fakeStore()

    const result = await syncCatalog({ full: true }, { client, store, ...BASE_DEPS })

    expect(result.expectedProducts).toBeNull()
    expect(result.products).toBe(1)
  })
})
