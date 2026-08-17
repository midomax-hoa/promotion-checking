/**
 * Token bucket in front of the Haravan API.
 *
 * Measured on the dev store: the server keeps a bucket of 80 calls that leaks
 * 4 requests/second and answers 429 with `Retry-After` once it overflows. Every
 * response carries `X-Haravan-Api-Call-Limit: <used>/<capacity>`, so the client
 * can slow down before it gets rejected instead of after.
 *
 * The clock is injectable so tests do not have to wait in real time.
 */

export const CALL_LIMIT_HEADER = 'X-Haravan-Api-Call-Limit'

/** Drain our own bucket once the server bucket is this full. */
const DEFAULT_NEAR_FULL_RATIO = 0.8

export type RateLimiterClock = {
  now(): number
  sleep(ms: number): Promise<void>
}

export type RateLimiter = {
  /** Resolves when it is this caller's turn to send a request. */
  acquire(): Promise<void>
  /** Feeds `X-Haravan-Api-Call-Limit` back in so the limiter can slow down. */
  noteHeader(header: string | null | undefined): void
}

export type RateLimiterOptions = {
  /** Burst size. Defaults to one second worth of requests. */
  burst?: number
  clock?: RateLimiterClock
  nearFullRatio?: number
}

export type CallLimitUsage = { used: number; capacity: number }

const defaultClock: RateLimiterClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}

/** Parses `"32/80"`. Returns null for anything else, including a missing header. */
export function parseCallLimitHeader(header: string | null | undefined): CallLimitUsage | null {
  if (!header) return null
  const match = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(header)
  if (!match) return null
  const used = Number(match[1])
  const capacity = Number(match[2])
  if (!Number.isFinite(capacity) || capacity <= 0) return null
  return { used, capacity }
}

export function createRateLimiter(
  perSecond: number,
  options: RateLimiterOptions = {},
): RateLimiter {
  const clock = options.clock ?? defaultClock
  // A non-positive rate would mean "never send anything"; clamp to a slow trickle.
  const rate = perSecond > 0 ? perSecond : 0.1
  const capacity = Math.max(1, Math.floor(options.burst ?? rate))
  const nearFullRatio = options.nearFullRatio ?? DEFAULT_NEAR_FULL_RATIO
  const tokensPerMs = rate / 1000

  let tokens = capacity
  let lastRefillAt = clock.now()
  // Requests are served one at a time so concurrent callers cannot all decide
  // they hold the same last token.
  let queue: Promise<void> = Promise.resolve()

  function refill(): void {
    const now = clock.now()
    const elapsed = now - lastRefillAt
    if (elapsed <= 0) return
    lastRefillAt = now
    tokens = Math.min(capacity, tokens + elapsed * tokensPerMs)
  }

  async function take(): Promise<void> {
    refill()
    if (tokens < 1) {
      await clock.sleep(Math.ceil((1 - tokens) / tokensPerMs))
      refill()
    }
    tokens = Math.max(0, tokens - 1)
  }

  return {
    acquire() {
      const turn = queue.then(() => take())
      // Keep the chain alive even if one caller is cancelled upstream.
      queue = turn.catch(() => undefined)
      return turn
    },
    noteHeader(header) {
      const usage = parseCallLimitHeader(header)
      if (!usage) return
      if (usage.used / usage.capacity >= nearFullRatio) {
        // Empty our bucket: the next caller waits a full token refill, which
        // gives the server bucket time to leak back down.
        refill()
        tokens = 0
      }
    },
  }
}
