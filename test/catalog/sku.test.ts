import { describe, expect, it } from 'vitest'
import { displaySku, isBlankSku, normalizeSku } from '@/lib/catalog/sku'

describe('normalizeSku', () => {
  it('trims and lower-cases so lookups match regardless of typing', () => {
    expect(normalizeSku('  ABC-123 ')).toBe('abc-123')
    expect(normalizeSku('abc-123')).toBe('abc-123')
  })

  it('turns anything blank into null - a blank SKU must never reach the API', () => {
    expect(normalizeSku('')).toBeNull()
    expect(normalizeSku('   ')).toBeNull()
    expect(normalizeSku('\t\n')).toBeNull()
    expect(normalizeSku(null)).toBeNull()
    expect(normalizeSku(undefined)).toBeNull()
  })
})

describe('displaySku', () => {
  it('trims but keeps the original casing', () => {
    expect(displaySku(' ABC-123 ')).toBe('ABC-123')
    expect(displaySku('  ')).toBeNull()
  })
})

describe('isBlankSku', () => {
  it('agrees with normalizeSku', () => {
    expect(isBlankSku(' ')).toBe(true)
    expect(isBlankSku(null)).toBe(true)
    expect(isBlankSku('x')).toBe(false)
  })
})
