import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Pins the single-flight sharing in `tryFetchPromotionsForRules`.
 *
 * `/api/check` has no running-guard, so two overlapping uploads reach this
 * function at the same time. Without sharing, each would start its own paced
 * walk and their interleaved requests would defeat the per-walk delay - the
 * exact cadence that provokes 429s on this endpoint.
 */

const fetchAllPromotions = vi.fn()

vi.mock('@/lib/config/app-config', () => ({
  getAppConfig: vi.fn(async () => ({
    haravanPromotionPageSize: 250,
    haravanPromotionMaxPages: 200,
    haravanPromotionDelayMs: 0,
  })),
}))
vi.mock('@/lib/haravan/haravan-client', () => ({
  createHaravanClient: vi.fn(async () => ({})),
}))
vi.mock('@/lib/haravan/promotion-fetcher', () => ({
  fetchAllPromotions: (...args: unknown[]) => fetchAllPromotions(...args),
}))

/** The in-flight promise is module state, so every test gets a fresh module. */
async function freshModule() {
  vi.resetModules()
  return import('@/lib/haravan/run-promotion-fetch')
}

beforeEach(() => {
  fetchAllPromotions.mockReset()
})

describe('tryFetchPromotionsForRules', () => {
  it('shares one in-flight walk between concurrent checks', async () => {
    const { tryFetchPromotionsForRules } = await freshModule()
    let finishWalk!: (value: unknown) => void
    fetchAllPromotions.mockImplementation(
      () => new Promise((resolve) => {
        finishWalk = resolve
      }),
    )

    const first = tryFetchPromotionsForRules()
    const second = tryFetchPromotionsForRules()
    // The walk starts a few microtasks in (config + client are awaited first).
    await vi.waitFor(() => expect(fetchAllPromotions).toHaveBeenCalledTimes(1))
    finishWalk([{ id: 1 }])

    expect(await first).toEqual([{ id: 1 }])
    expect(await second).toEqual([{ id: 1 }])
    expect(fetchAllPromotions).toHaveBeenCalledTimes(1)
  })

  it('starts a fresh walk once the previous one has settled', async () => {
    const { tryFetchPromotionsForRules } = await freshModule()
    fetchAllPromotions.mockResolvedValue([])

    await tryFetchPromotionsForRules()
    await tryFetchPromotionsForRules()

    // Sequential checks must see fresh data, not a forever-cached list.
    expect(fetchAllPromotions).toHaveBeenCalledTimes(2)
  })

  it('turns a failed walk into null for every waiter, then retries next time', async () => {
    const { tryFetchPromotionsForRules } = await freshModule()
    // Silenced: the function under test logs the failure on purpose.
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    fetchAllPromotions.mockRejectedValueOnce(new Error('429 het ngan sach'))

    const [first, second] = await Promise.all([
      tryFetchPromotionsForRules(),
      tryFetchPromotionsForRules(),
    ])
    expect(first).toBeNull()
    expect(second).toBeNull()

    fetchAllPromotions.mockResolvedValueOnce([{ id: 2 }])
    expect(await tryFetchPromotionsForRules()).toEqual([{ id: 2 }])
    errorLog.mockRestore()
  })
})
