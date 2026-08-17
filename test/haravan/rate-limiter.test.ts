import { describe, expect, it } from 'vitest'
import {
  createRateLimiter,
  parseCallLimitHeader,
  type RateLimiterClock,
} from '@/lib/haravan/rate-limiter'

/** Virtual clock: sleeping moves time forward instead of waiting. */
function fakeClock() {
  let current = 0
  const slept: number[] = []
  const clock: RateLimiterClock = {
    now: () => current,
    sleep: async (ms) => {
      slept.push(ms)
      current += ms
    },
  }
  return { clock, slept, advance: (ms: number) => (current += ms) }
}

describe('parseCallLimitHeader', () => {
  it('reads the "used/capacity" form Haravan sends', () => {
    expect(parseCallLimitHeader('32/80')).toEqual({ used: 32, capacity: 80 })
    expect(parseCallLimitHeader(' 1 / 80 ')).toEqual({ used: 1, capacity: 80 })
  })

  it('returns null for anything unusable', () => {
    expect(parseCallLimitHeader(null)).toBeNull()
    expect(parseCallLimitHeader('')).toBeNull()
    expect(parseCallLimitHeader('abc')).toBeNull()
    expect(parseCallLimitHeader('5/0')).toBeNull()
  })
})

describe('createRateLimiter', () => {
  it('lets a burst through, then spaces the rest out', async () => {
    const { clock, slept } = fakeClock()
    const limiter = createRateLimiter(2, { burst: 2, clock })

    await limiter.acquire()
    await limiter.acquire()
    expect(slept).toEqual([])

    await limiter.acquire()
    // 2 req/s means one token every 500ms.
    expect(slept).toEqual([500])
  })

  it('refills over time', async () => {
    const { clock, slept, advance } = fakeClock()
    const limiter = createRateLimiter(4, { burst: 1, clock })

    await limiter.acquire()
    advance(250)
    await limiter.acquire()
    expect(slept).toEqual([])
  })

  it('serialises concurrent callers instead of handing out the same token', async () => {
    const { clock, slept } = fakeClock()
    const limiter = createRateLimiter(2, { burst: 1, clock })

    await Promise.all([limiter.acquire(), limiter.acquire(), limiter.acquire()])
    expect(slept).toEqual([500, 500])
  })

  it('drains its bucket when the server bucket is nearly full', async () => {
    const { clock, slept } = fakeClock()
    const limiter = createRateLimiter(2, { burst: 5, clock })

    limiter.noteHeader('70/80')
    await limiter.acquire()
    expect(slept).toEqual([500])
  })

  it('ignores a healthy or unreadable header', async () => {
    const { clock, slept } = fakeClock()
    const limiter = createRateLimiter(2, { burst: 5, clock })

    limiter.noteHeader('1/80')
    limiter.noteHeader('rác')
    limiter.noteHeader(null)
    await limiter.acquire()
    expect(slept).toEqual([])
  })
})
