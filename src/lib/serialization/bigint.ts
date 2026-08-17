/**
 * Haravan variant and product ids are stored as BIGINT, and JSON.stringify throws
 * on a BigInt value. Everything crossing the server -> browser boundary must go
 * through here first, otherwise the failure only shows up at runtime.
 */

type JsonSafe<T> = T extends bigint
  ? string
  : T extends Date
    ? Date
    : T extends (infer U)[]
      ? JsonSafe<U>[]
      : T extends object
        ? { [K in keyof T]: JsonSafe<T[K]> }
        : T

/** Recursively replaces every BigInt with its decimal string form. */
export function serializeBigInt<T>(value: T): JsonSafe<T> {
  if (typeof value === 'bigint') return value.toString() as JsonSafe<T>
  if (value === null || typeof value !== 'object') return value as JsonSafe<T>
  if (value instanceof Date) return value as JsonSafe<T>
  if (Array.isArray(value)) return value.map(serializeBigInt) as JsonSafe<T>

  const entries = Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
    key,
    serializeBigInt(inner),
  ])
  return Object.fromEntries(entries) as JsonSafe<T>
}

/** Parses an id coming back from the browser, where it is always a string. */
export function parseBigInt(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') return value
  const text = String(value).trim()
  if (!/^-?\d+$/.test(text)) {
    throw new Error(`Giá trị "${value}" không phải số nguyên hợp lệ.`)
  }
  return BigInt(text)
}
