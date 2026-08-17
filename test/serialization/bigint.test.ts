import { describe, expect, it } from 'vitest'
import { parseBigInt, serializeBigInt } from '@/lib/serialization/bigint'

describe('serializeBigInt', () => {
  it('turns a nested VariantCache-shaped row into JSON-safe data', () => {
    const syncedAt = new Date('2026-08-17T00:00:00.000Z')
    const row = {
      variantId: 1234567890123456789n,
      productId: 42n,
      sku: 'KMAP231728F.XL',
      price: 199000,
      syncedAt,
      tags: [{ id: 7n }, { id: 8n }],
      barcode: null,
    }

    const result = serializeBigInt(row)

    expect(result).toEqual({
      variantId: '1234567890123456789',
      productId: '42',
      sku: 'KMAP231728F.XL',
      price: 199000,
      syncedAt,
      tags: [{ id: '7' }, { id: '8' }],
      barcode: null,
    })
    expect(() => JSON.stringify(result)).not.toThrow()
  })

  it('throws without the helper, proving the helper is needed', () => {
    expect(() => JSON.stringify({ variantId: 1n })).toThrow(TypeError)
  })
})

describe('parseBigInt', () => {
  it('accepts strings, numbers and bigints', () => {
    expect(parseBigInt('1234567890123456789')).toBe(1234567890123456789n)
    expect(parseBigInt(42)).toBe(42n)
    expect(parseBigInt(7n)).toBe(7n)
  })

  it('rejects anything that is not an integer', () => {
    expect(() => parseBigInt('12.5')).toThrow()
    expect(() => parseBigInt('abc')).toThrow()
    expect(() => parseBigInt('')).toThrow()
  })
})
