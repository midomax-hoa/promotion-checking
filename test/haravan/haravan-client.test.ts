import { describe, expect, it, vi } from 'vitest'
import { HaravanClient, buildQueryString } from '@/lib/haravan/haravan-client'
import {
  HaravanApiError,
  HaravanBlankQueryError,
  HaravanNetworkError,
  HaravanRateLimitError,
  HaravanRawQueryError,
  HaravanTokenMissingError,
} from '@/lib/haravan/haravan-errors'
import type { RateLimiter } from '@/lib/haravan/rate-limiter'

function recordingLimiter() {
  const headers: (string | null | undefined)[] = []
  const limiter: RateLimiter = {
    acquire: async () => undefined,
    noteHeader: (header) => headers.push(header),
  }
  return { limiter, headers }
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Haravan-Api-Call-Limit': '1/80' },
  })
}

function errorResponse(status: number, body = 'loi', headers: Record<string, string> = {}) {
  return new Response(body, { status, headers })
}

function makeClient(
  responses: Response[],
  overrides: { maxAttempts?: number; rateLimitMaxAttempts?: number } = {},
) {
  const { limiter, headers } = recordingLimiter()
  const slept: number[] = []
  let index = 0
  const fetchImpl = vi.fn(async () => {
    const next = responses[Math.min(index, responses.length - 1)]
    index += 1
    // A Response body can only be read once, and the last entry is reused for
    // every remaining attempt, so hand out a clone each time.
    return next.clone()
  })
  const client = new HaravanClient({
    baseUrl: 'https://apis.haravan.com/',
    token: 'token-gia-lap',
    limiter,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    sleep: async (ms) => {
      slept.push(ms)
    },
    maxAttempts: overrides.maxAttempts ?? 4,
    rateLimitMaxAttempts: overrides.rateLimitMaxAttempts,
  })
  return { client, fetchImpl, slept, headers }
}

/** Awaits a call that is expected to fail and hands the error back typed. */
async function captureError(promise: Promise<unknown>): Promise<Error & { status?: number }> {
  try {
    await promise
    throw new Error('Lệnh gọi lẽ ra phải thất bại nhưng lại thành công.')
  } catch (error) {
    return error as Error & { status?: number }
  }
}

describe('buildQueryString', () => {
  it('refuses a blank value instead of sending it', () => {
    // Verified on the dev store: `?sku=` returns 50 arbitrary products.
    expect(() => buildQueryString({ sku: '' }, '/com/products.json')).toThrow(HaravanBlankQueryError)
    expect(() => buildQueryString({ sku: '   ' })).toThrow(HaravanBlankQueryError)
  })

  it('skips null and undefined but keeps real values', () => {
    expect(buildQueryString({ limit: 50, page: 1, updated_at_min: null })).toBe('?limit=50&page=1')
    expect(buildQueryString(undefined)).toBe('')
    expect(buildQueryString({})).toBe('')
  })
})

describe('HaravanClient', () => {
  it('refuses to be built without a token', () => {
    const { limiter } = recordingLimiter()
    expect(
      () => new HaravanClient({ baseUrl: 'https://apis.haravan.com', token: '  ', limiter }),
    ).toThrow(HaravanTokenMissingError)
  })

  it('never sends a request carrying a blank SKU', async () => {
    const { client, fetchImpl } = makeClient([jsonResponse({ products: [] })])

    await expect(client.get('/com/products.json', { sku: '' })).rejects.toBeInstanceOf(
      HaravanBlankQueryError,
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('refuses a path that already carries a query string', async () => {
    // Otherwise `get(`/com/products.json?sku=${sku}`)` would walk straight past
    // the blank-value check with an empty sku.
    const { client, fetchImpl } = makeClient([jsonResponse({ products: [] })])

    await expect(client.get('/com/products.json?sku=')).rejects.toBeInstanceOf(HaravanRawQueryError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('waits for Retry-After on a 429 and then succeeds', async () => {
    const { client, slept, fetchImpl } = makeClient([
      errorResponse(429, 'qua nhieu', { 'Retry-After': '2' }),
      jsonResponse({ products: [{ id: 1 }] }),
    ])

    const result = await client.get<{ products: unknown[] }>('/com/products.json')

    expect(result.products).toHaveLength(1)
    expect(slept).toEqual([2000])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('reports a rate limit as a rate limit, not as bad data', async () => {
    const { client, fetchImpl } = makeClient([errorResponse(429, 'qua nhieu')], {
      rateLimitMaxAttempts: 4,
    })

    const error = await captureError(client.get('/com/products.json'))

    expect(error).toBeInstanceOf(HaravanRateLimitError)
    expect(error.message).toContain('giới hạn nhịp')
    // The error must carry the true count, not a constant.
    expect((error as HaravanRateLimitError).attempts).toBe(4)
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it('escalates header-less 429 waits the same way 5xx backoff does', async () => {
    const { client, slept } = makeClient([
      errorResponse(429),
      errorResponse(429),
      errorResponse(429),
      jsonResponse({ ok: true }),
    ])

    await client.get('/com/promotions.json')

    expect(slept).toEqual([500, 1000, 2000])
  })

  it('treats Retry-After as a floor, not the whole truth', async () => {
    // The premise of the paced walk is that this endpoint's own headers
    // under-report its throttle. A server stuck answering "Retry-After: 1"
    // (or 0) must not be able to burn the whole patient budget in seconds -
    // consecutive 429s keep escalating past the header's advice.
    const { client, slept } = makeClient([
      errorResponse(429, 'cho', { 'Retry-After': '1' }),
      errorResponse(429, 'cho', { 'Retry-After': '1' }),
      errorResponse(429, 'cho', { 'Retry-After': '1' }),
      errorResponse(429, 'cho', { 'Retry-After': '0' }),
      jsonResponse({ ok: true }),
    ])

    await client.get('/com/promotions.json')

    // max(header, escalating backoff): 1s holds until the backoff passes it.
    expect(slept).toEqual([1000, 1000, 2000, 4000])
  })

  it('retries a 429 far past the network attempt budget', async () => {
    // The promotion walk of 2026-08-19 died at attempt four on a throttle that
    // only needed patience. 429s now spend their own, much larger budget.
    const { client, fetchImpl } = makeClient(
      [
        ...Array.from({ length: 9 }, () => errorResponse(429, 'qua nhieu', { 'Retry-After': '1' })),
        jsonResponse({ promotions: [{ id: 1 }] }),
      ],
      { maxAttempts: 4, rateLimitMaxAttempts: 30 },
    )

    const result = await client.get<{ promotions: unknown[] }>('/com/promotions.json')

    expect(result.promotions).toHaveLength(1)
    expect(fetchImpl).toHaveBeenCalledTimes(10)
  })

  it('keeps 429 and network budgets apart', async () => {
    // Three 429s must not eat into the network budget of two: the call still
    // survives a network hiccup after them.
    const { limiter } = recordingLimiter()
    const answers = [
      errorResponse(429),
      errorResponse(429),
      errorResponse(429),
      'network' as const,
      jsonResponse({ ok: true }),
    ]
    let index = 0
    const fetchImpl = vi.fn(async () => {
      const next = answers[index]
      index += 1
      if (next === 'network') throw new Error('ECONNRESET')
      return (next as Response).clone()
    })
    const client = new HaravanClient({
      baseUrl: 'https://apis.haravan.com',
      token: 'token-gia-lap',
      limiter,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => undefined,
      maxAttempts: 2,
      rateLimitMaxAttempts: 30,
    })

    await expect(client.get('/com/promotions.json')).resolves.toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledTimes(5)
  })

  it('retries a 5xx with growing backoff', async () => {
    const { client, slept } = makeClient([
      errorResponse(500),
      errorResponse(500),
      jsonResponse({ ok: true }),
    ])

    await client.get('/com/products.json')

    expect(slept).toEqual([500, 1000])
  })

  it('does not retry a 4xx that is not a rate limit', async () => {
    const { client, fetchImpl } = makeClient([errorResponse(404, 'khong thay')])

    const error = await captureError(client.get('/com/products.json'))

    expect(error).toBeInstanceOf(HaravanApiError)
    expect(error).not.toBeInstanceOf(HaravanRateLimitError)
    expect(error.status).toBe(404)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries a network failure and gives up with a distinct error', async () => {
    const { limiter } = recordingLimiter()
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNRESET')
    })
    const client = new HaravanClient({
      baseUrl: 'https://apis.haravan.com',
      token: 'token-gia-lap',
      limiter,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => undefined,
      maxAttempts: 3,
    })

    await expect(client.get('/com/products.json')).rejects.toBeInstanceOf(HaravanNetworkError)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('feeds the call limit header back to the limiter and sends a Bearer token', async () => {
    const { client, headers, fetchImpl } = makeClient([jsonResponse({ ok: true })])

    await client.get('/com/products.json', { limit: 50 })

    expect(headers).toEqual(['1/80'])
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://apis.haravan.com/com/products.json?limit=50')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-gia-lap')
  })

  it('keeps the token out of error messages, even when the body echoes it back', async () => {
    const { client } = makeClient([errorResponse(422, 'loi voi token token-gia-lap')])

    const error = await captureError(client.get('/com/products.json'))

    expect(error.message).not.toContain('token-gia-lap')
    expect(error.message).toContain('***')
  })
})
