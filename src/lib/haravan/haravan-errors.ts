/**
 * Error types for the Haravan client.
 *
 * They exist so the sync can tell three very different situations apart:
 * a throttling hiccup that should be retried, a real API rejection, and a
 * programming mistake that must never reach the network.
 *
 * No error message ever includes request headers - the API token lives there.
 */

/** Any non-2xx answer from Haravan. */
export class HaravanApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    readonly path: string,
  ) {
    super(`Haravan trả lỗi ${status} khi gọi ${path}: ${truncate(body)}`)
    this.name = 'HaravanApiError'
  }
}

/** 429 that survived every retry - the caller must back off, not treat it as bad data. */
export class HaravanRateLimitError extends HaravanApiError {
  constructor(status: number, body: string, path: string, readonly attempts: number) {
    super(status, body, path)
    this.name = 'HaravanRateLimitError'
    this.message = `Haravan giới hạn nhịp gọi (${status}) sau ${attempts} lần thử khi gọi ${path}. Đây là lỗi giới hạn nhịp, không phải dữ liệu sai.`
  }
}

/** Network failure that survived every retry. */
export class HaravanNetworkError extends Error {
  constructor(readonly path: string, readonly attempts: number, options?: { cause?: unknown }) {
    super(`Không kết nối được tới Haravan sau ${attempts} lần thử khi gọi ${path}.`, options)
    this.name = 'HaravanNetworkError'
  }
}

/**
 * A query parameter was blank.
 *
 * Verified on the dev store: `products.json?sku=` (empty value) answers with 50
 * arbitrary products instead of an error, so a blank SKU would quietly bind a
 * promotion row to an unrelated product. The request is refused before it is sent.
 */
export class HaravanBlankQueryError extends Error {
  constructor(readonly parameter: string, readonly path: string) {
    super(
      `Tham số "${parameter}" rỗng nên không được phép gửi lên Haravan (${path}). ` +
        `Truy vấn rỗng trả về sản phẩm bất kỳ, dễ gắn nhầm sản phẩm.`,
    )
    this.name = 'HaravanBlankQueryError'
  }
}

/**
 * The path already carried a query string.
 *
 * Query values must go through the `query` argument, otherwise the blank-value
 * check above is bypassed and `?sku=` can reach Haravan after all.
 */
export class HaravanRawQueryError extends Error {
  constructor(readonly path: string) {
    super(
      `Đường dẫn "${path}" đã chứa sẵn query string. Mọi tham số phải truyền qua đối số "query" ` +
        `để chốt chặn giá trị rỗng còn tác dụng.`,
    )
    this.name = 'HaravanRawQueryError'
  }
}

/** Missing or empty HARAVAN_API_TOKEN. */
export class HaravanTokenMissingError extends Error {
  constructor() {
    super('Thiếu biến môi trường HARAVAN_API_TOKEN. Xem file .env.example.')
    this.name = 'HaravanTokenMissingError'
  }
}

function truncate(body: string, max = 300): string {
  const text = body.trim()
  return text.length > max ? `${text.slice(0, max)}...` : text
}
