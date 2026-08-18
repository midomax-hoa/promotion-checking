import { describe, expect, it, vi } from 'vitest'
import { fetchAllPromotions, PromotionFetchError } from '@/lib/haravan/promotion-fetcher'
import { PROMOTIONS_PATH, type RawHaravanPromotion } from '@/lib/haravan/promotion-types'
import type { HaravanClient } from '@/lib/haravan/haravan-client'

function promotion(id: number): RawHaravanPromotion {
  return {
    id,
    name: `CTKM ${id}`,
    starts_at: '2026-07-31T17:00:00Z',
    ends_at: null,
    value: 1000,
    discount_type: 'product_amount',
    take_type: 'fixed_amount',
    status: 'enabled',
    usage_limit: null,
  }
}

/** A client that answers page N with the Nth prepared batch. */
function fakeClient(pages: RawHaravanPromotion[][], get = vi.fn()) {
  get.mockImplementation(async (_path: string, query: { page: number }) => ({
    promotions: pages[query.page - 1] ?? [],
  }))
  return { get } as unknown as HaravanClient
}

const page = (from: number, count: number) =>
  Array.from({ length: count }, (_, index) => promotion(from + index))

describe('fetchAllPromotions', () => {
  it('walks every page until a short one', async () => {
    const get = vi.fn()
    const client = fakeClient([page(1, 50), page(51, 50), page(101, 7)], get)

    const result = await fetchAllPromotions(client, { pageSize: 50 })

    expect(result).toHaveLength(107)
    expect(get).toHaveBeenCalledTimes(3)
    expect(get).toHaveBeenLastCalledWith(PROMOTIONS_PATH, { limit: 50, page: 3 })
  })

  /**
   * A short first page cannot be told apart from a server-side clamp, so one
   * confirming call is made. Asserted rather than tolerated: the extra request
   * is a deliberate trade, and a future change that removes it would silently
   * truncate the walk on a shop whose `limit` really is clamped.
   */
  it('confirms with one more call when the first page is short', async () => {
    const get = vi.fn()
    const client = fakeClient([page(1, 1)], get)

    expect(await fetchAllPromotions(client, { pageSize: 50 })).toHaveLength(1)
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('stops immediately when the first page is empty', async () => {
    const get = vi.fn()
    const client = fakeClient([[]], get)

    expect(await fetchAllPromotions(client, { pageSize: 50 })).toEqual([])
    expect(get).toHaveBeenCalledTimes(1)
  })

  /**
   * Haravan clamps `limit` on the products endpoint; whether it does the same
   * here could not be established on the dev store (one promotion in total). So
   * the real page size is learned from the first page instead of trusted, which
   * keeps the walk correct either way.
   */
  it('learns the real page size from the first page', async () => {
    const get = vi.fn()
    const client = fakeClient([page(1, 50), page(51, 50), page(101, 3)], get)

    // Asks for 250, is served 50 - without learning, page 1 would look short
    // and the walk would stop at 50 of 103.
    const result = await fetchAllPromotions(client, { pageSize: 250 })
    expect(result).toHaveLength(103)
  })

  it('handles an empty shop', async () => {
    expect(await fetchAllPromotions(fakeClient([[]]), { pageSize: 50 })).toEqual([])
  })

  it('reports progress per page', async () => {
    const seen: { page: number; promotions: number; done: boolean }[] = []
    await fetchAllPromotions(fakeClient([page(1, 50), page(51, 2)]), {
      pageSize: 50,
      onProgress: (progress) => seen.push(progress),
    })

    expect(seen).toEqual([
      { page: 1, promotions: 50, done: false },
      { page: 2, promotions: 52, done: true },
    ])
  })

  it('names the page it failed on', async () => {
    const get = vi.fn(async (_path: string, query: { page: number }) => {
      if (query.page === 2) throw new Error('mạng rớt')
      return { promotions: page(1, 50) }
    })
    const client = { get } as unknown as HaravanClient

    await expect(fetchAllPromotions(client, { pageSize: 50 })).rejects.toMatchObject({
      name: 'PromotionFetchError',
      page: 2,
    })
  })

  it('carries the underlying cause so the operator sees why', async () => {
    const cause = new Error('401 hết hạn token')
    const client = {
      get: vi.fn(async () => {
        throw cause
      }),
    } as unknown as HaravanClient

    const error = await fetchAllPromotions(client, { pageSize: 50 }).catch((e) => e)
    expect(error).toBeInstanceOf(PromotionFetchError)
    expect(error.cause).toBe(cause)
  })

  it('never issues anything but a read', async () => {
    const client = fakeClient([page(1, 1)])
    await fetchAllPromotions(client, { pageSize: 50 })
    // The client only exposes `get`; this asserts the fetcher never reached for
    // anything else, which is the phase's read-only guarantee in code form.
    expect(Object.keys(client)).toEqual(['get'])
  })
})
