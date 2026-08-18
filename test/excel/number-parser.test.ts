import { describe, expect, it } from 'vitest'
import { parseNumber } from '@/lib/excel/number-parser'

const value = (raw: unknown) => {
  const parsed = parseNumber(raw)
  return parsed.ok ? parsed.value : 'FAILED'
}

describe('parseNumber - blank is not zero', () => {
  it.each([null, undefined, '', '   ', { formula: 'F2-H2' }])(
    'reads %s as null so an empty cell never becomes a 0đ discount',
    (raw) => {
      expect(value(raw)).toBeNull()
    },
  )

  it('still reads a real zero as zero - that is a finding, not an absence', () => {
    expect(value(0)).toBe(0)
    expect(value('0')).toBe(0)
    expect(value({ formula: 'F2-H2', result: 0 })).toBe(0)
  })
})

describe('parseNumber - cleaning', () => {
  it('strips thousands separators, quotes and spaces', () => {
    expect(value('130,000')).toBe(130000)
    expect(value(" 1'234'567 ")).toBe(1234567)
    expect(value('289 000')).toBe(289000)
    expect(value('"130000"')).toBe(130000)
  })

  it('keeps decimals, which is how Phần trăm giảm is stored', () => {
    expect(value(0.5)).toBe(0.5)
    expect(value('0.3')).toBe(0.3)
    expect(value('.75')).toBe(0.75)
  })

  it('accepts a sign', () => {
    expect(value('-5000')).toBe(-5000)
    expect(value('+5000')).toBe(5000)
  })

  it('reads through a formula cell', () => {
    expect(value({ formula: 'F2-H2', result: 130000 })).toBe(130000)
    expect(value({ sharedFormula: 'I2', result: 24000 })).toBe(24000)
  })
})

describe('parseNumber - refuses to guess', () => {
  it.each([
    ['free text', 'khoảng 130k'],
    ['trailing junk', '130000đ'],
    ['a percent sign - 50% could mean 50 or 0.5', '50%'],
    ['hex, which Number() would read as 16', '0x10'],
    ['exponent notation typed by hand', '1e5'],
    ['two separators in a row', '1..5'],
    ['a boolean', true],
    ['a date', new Date('2026-08-01')],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['NaN', Number.NaN],
    ['a formula error', { error: '#DIV/0!' }],
  ])('rejects %s', (_label, raw) => {
    expect(parseNumber(raw).ok).toBe(false)
  })

  it('reports the original value so the message can quote what was typed', () => {
    const parsed = parseNumber('khoảng 130k')
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.raw).toBe('khoảng 130k')
  })
})
