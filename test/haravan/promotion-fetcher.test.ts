import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_MAX_PAGES,
  fetchAllPromotions,
  PromotionFetchError,
  PromotionPageLimitError,
} from '@/lib/haravan/promotion-fetcher'
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

  /**
   * `/com/promotions.json` throttles harder than the shared limiter knows
   * (measured 2026-08-19: 350 ms spacing 429s by page 7, 1100 ms runs clean),
   * so the walk paces itself. The rest goes between pages only: a shop whose
   * whole list fits in one page must not wait at all.
   */
  it('rests between pages but not before the first or after the last', async () => {
    const slept: number[] = []
    const sleep = async (ms: number) => {
      slept.push(ms)
    }

    await fetchAllPromotions(fakeClient([page(1, 50), page(51, 50), page(101, 3)]), {
      pageSize: 50,
      delayMs: 1200,
      sleep,
    })

    // Three pages, two gaps.
    expect(slept).toEqual([1200, 1200])
  })

  it('skips the rest entirely when the delay is zero', async () => {
    const sleep = vi.fn(async () => undefined)
    await fetchAllPromotions(fakeClient([page(1, 50), page(51, 2)]), {
      pageSize: 50,
      delayMs: 0,
      sleep,
    })
    expect(sleep).not.toHaveBeenCalled()
  })

  it('never issues anything but a read', async () => {
    const client = fakeClient([page(1, 1)])
    await fetchAllPromotions(client, { pageSize: 50 })
    // The client only exposes `get`; this asserts the fetcher never reached for
    // anything else, which is the phase's read-only guarantee in code form.
    expect(Object.keys(client)).toEqual(['get'])
  })
})

describe('the page cap', () => {
  /** A client that never runs out, so the walk can only end at the cap. */
  const endlessClient = (size: number) =>
    ({
      get: vi.fn(async (_path: string, query: { page: number }) =>
        ({ promotions: page((query.page - 1) * size + 1, size) })),
    }) as unknown as HaravanClient

  it('stops at the configured cap rather than the built-in one', async () => {
    const client = endlessClient(5)
    await expect(
      fetchAllPromotions(client, { pageSize: 5, maxPages: 3 }),
    ).rejects.toBeInstanceOf(PromotionPageLimitError)
    // Three pages attempted, not the 200 the module falls back to.
    expect((client.get as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(3)
  })

  it('falls back to the built-in cap when the caller passes none', async () => {
    const client = endlessClient(1)
    await expect(fetchAllPromotions(client, { pageSize: 1 })).rejects.toBeInstanceOf(
      PromotionPageLimitError,
    )
    expect((client.get as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(DEFAULT_MAX_PAGES)
  })

  it('says why it stopped, and how to get past it', async () => {
    // "stopped at page 200" reads like a network hiccup and sends people
    // retrying forever; the cause and the way out have to be in the message.
    const error = await fetchAllPromotions(endlessClient(250), {
      pageSize: 250,
      maxPages: 4,
    }).catch((e) => e)

    expect(error).toBeInstanceOf(PromotionPageLimitError)
    expect(error.message).toContain('4 trang')
    expect(error.message).toContain('250')
    expect(error.message).toContain('haravan.promotion_max_pages')
  })

  it('is still caught by anything handling PromotionFetchError', async () => {
    // The reconcile route forwards PromotionFetchError to the screen verbatim;
    // a cap error that escaped that check would surface as a generic 500.
    const error = await fetchAllPromotions(endlessClient(2), {
      pageSize: 2,
      maxPages: 1,
    }).catch((e) => e)
    expect(error).toBeInstanceOf(PromotionFetchError)
  })

  it('never reports a cap error while pages are still shrinking', async () => {
    const client = fakeClient([page(1, 10), page(11, 10), page(21, 3)])
    await expect(fetchAllPromotions(client, { pageSize: 10, maxPages: 3 })).resolves.toHaveLength(
      23,
    )
  })
})
