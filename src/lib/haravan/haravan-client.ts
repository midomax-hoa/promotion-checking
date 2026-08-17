import {
  HaravanApiError,
  HaravanBlankQueryError,
  HaravanNetworkError,
  HaravanRateLimitError,
  HaravanRawQueryError,
  HaravanTokenMissingError,
} from './haravan-errors'
import { CALL_LIMIT_HEADER, createRateLimiter, type RateLimiter } from './rate-limiter'
import { getAppConfig } from '@/lib/config/app-config'

/**
 * Read-only Haravan client.
 *
 * This whole tool never writes to Haravan, so only GET is implemented.
 * Behaviour verified against the dev store on 2026-08-17:
 *   - rate limit bucket 80, leaking 4 req/s, 429 carries `Retry-After`
 *   - a blank query value (`?sku=`) returns 50 arbitrary products - refused here
 */

export type QueryValue = string | number | boolean | null | undefined
export type QueryParams = Record<string, QueryValue>

export type HaravanClientOptions = {
  baseUrl: string
  token: string
  limiter: RateLimiter
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  /** Total attempts, retries included. Four failures in a row stop the run. */
  maxAttempts?: number
}

const DEFAULT_MAX_ATTEMPTS = 4
const DEFAULT_BACKOFF_MS = 500
const MAX_BACKOFF_MS = 30_000

export class HaravanClient {
  private readonly baseUrl: string
  private readonly token: string
  private readonly limiter: RateLimiter
  private readonly fetchImpl: typeof fetch
  private readonly sleep: (ms: number) => Promise<void>
  private readonly maxAttempts: number

  constructor(options: HaravanClientOptions) {
    if (!options.token.trim()) throw new HaravanTokenMissingError()
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.token = options.token.trim()
    this.limiter = options.limiter
    this.fetchImpl = options.fetchImpl ?? fetch
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
    this.maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)
  }

  /** Makes "no error message ever contains the token" a guarantee, not a convention. */
  private redact(text: string): string {
    return text.split(this.token).join('***')
  }

  async get<T>(path: string, query?: QueryParams): Promise<T> {
    // Every parameter must go through `query` so the blank-value check below
    // cannot be bypassed by hand-building `?sku=${sku}` into the path.
    if (path.includes('?')) throw new HaravanRawQueryError(path)
    const url = `${this.baseUrl}${path}${buildQueryString(query, path)}`
    let lastCause: unknown

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      await this.limiter.acquire()

      let response: Response
      try {
        response = await this.fetchImpl(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/json',
          },
        })
      } catch (cause) {
        lastCause = cause
        if (attempt === this.maxAttempts) {
          throw new HaravanNetworkError(path, this.maxAttempts, { cause })
        }
        await this.sleep(backoffMs(attempt))
        continue
      }

      this.limiter.noteHeader(response.headers.get(CALL_LIMIT_HEADER))
      if (response.ok) return (await response.json()) as T

      const body = this.redact(await readBodySafely(response))
      const retryable = response.status === 429 || response.status >= 500
      if (!retryable) throw new HaravanApiError(response.status, body, path)

      if (attempt === this.maxAttempts) {
        throw response.status === 429
          ? new HaravanRateLimitError(response.status, body, path, this.maxAttempts)
          : new HaravanApiError(response.status, body, path)
      }
      await this.sleep(retryDelayMs(response, attempt))
    }

    // Unreachable: the loop always returns or throws.
    throw new HaravanNetworkError(path, this.maxAttempts, { cause: lastCause })
  }
}

/**
 * Builds the query string and refuses blank values.
 * A blank value is always a bug upstream, never something worth sending.
 */
export function buildQueryString(query: QueryParams | undefined, path = ''): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    const text = String(value).trim()
    if (text.length === 0) throw new HaravanBlankQueryError(key, path)
    params.set(key, text)
  }
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}

/** `Retry-After` is either a number of seconds or an HTTP date. */
export function retryDelayMs(response: Response, attempt: number, now = Date.now()): number {
  const header = response.headers.get('Retry-After')
  if (header) {
    const seconds = Number(header)
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(Math.ceil(seconds * 1000), MAX_BACKOFF_MS)
    }
    const until = Date.parse(header)
    if (Number.isFinite(until)) return Math.min(Math.max(until - now, 0), MAX_BACKOFF_MS)
  }
  return backoffMs(attempt)
}

function backoffMs(attempt: number): number {
  return Math.min(DEFAULT_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS)
}

async function readBodySafely(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

/**
 * One limiter per API base, shared by every client in the process.
 *
 * Haravan counts calls per shop, not per client object. Two clients with their
 * own bucket (the sync and the promotion fetcher of phase 06 running at the same
 * time) would together exceed the 4 req/s leak and trigger 429s.
 */
const limitersByBase = new Map<string, { limiter: RateLimiter; perSecond: number }>()

function sharedLimiter(baseUrl: string, perSecond: number): RateLimiter {
  const existing = limitersByBase.get(baseUrl)
  // A settings change must take effect without a restart.
  if (existing && existing.perSecond === perSecond) return existing.limiter
  const limiter = createRateLimiter(perSecond)
  limitersByBase.set(baseUrl, { limiter, perSecond })
  return limiter
}

/**
 * Builds a client from the database settings plus the server-only token.
 * The token is read here and nowhere else, so it cannot leak into a client bundle.
 */
export async function createHaravanClient(
  overrides: Partial<HaravanClientOptions> = {},
): Promise<HaravanClient> {
  const config = await getAppConfig()
  const baseUrl = overrides.baseUrl ?? config.haravanApiBase
  const token = overrides.token ?? process.env.HARAVAN_API_TOKEN ?? ''
  return new HaravanClient({
    baseUrl,
    token,
    limiter: overrides.limiter ?? sharedLimiter(baseUrl, config.haravanRequestsPerSecond),
    fetchImpl: overrides.fetchImpl,
    sleep: overrides.sleep,
    maxAttempts: overrides.maxAttempts ?? config.haravanMaxAttempts,
  })
}
