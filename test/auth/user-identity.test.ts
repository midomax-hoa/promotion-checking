import { describe, expect, it } from 'vitest'
import {
  checkEmail,
  checkPassword,
  checkUsername,
  normalizeEmail,
  normalizeUsername,
} from '@/lib/auth/user-identity'

describe('normalizeUsername / normalizeEmail', () => {
  it('lower-cases and trims, so one person cannot end up with two accounts', () => {
    expect(normalizeUsername('  Hoa  ')).toBe('hoa')
    expect(normalizeEmail(' Hoa@Example.COM ')).toBe('hoa@example.com')
  })

  it('collapses the two Unicode spellings of the same letter', () => {
    const composed = 'hoà'
    expect(normalizeUsername(composed.normalize('NFD'))).toBe(normalizeUsername(composed))
  })
})

describe('checkUsername', () => {
  it('accepts a plain name and returns it normalised', () => {
    const result = checkUsername('Nhan.Vien_01')
    expect(result).toEqual({ ok: true, value: 'nhan.vien_01' })
  })

  it('rejects one that is too short or too long', () => {
    expect(checkUsername('ab').ok).toBe(false)
    expect(checkUsername('a'.repeat(33)).ok).toBe(false)
  })

  it('rejects spaces, accents and anything that would be typed two ways', () => {
    for (const bad of ['nhan vien', 'nhânviên', 'hoa@example.com', 'hoa!']) {
      expect(checkUsername(bad).ok).toBe(false)
    }
  })
})

describe('checkEmail', () => {
  it('accepts an ordinary address', () => {
    expect(checkEmail('Hoa@Example.vn')).toEqual({ ok: true, value: 'hoa@example.vn' })
  })

  it('rejects one without an @ or without a dotted domain', () => {
    for (const bad of ['hoa', 'hoa@example', 'hoa @example.vn', '@example.vn']) {
      expect(checkEmail(bad).ok).toBe(false)
    }
  })
})

describe('checkPassword', () => {
  it('applies the length the caller was configured with', () => {
    expect(checkPassword('1234567', 8).ok).toBe(false)
    expect(checkPassword('12345678', 8).ok).toBe(true)
    expect(checkPassword('123456', 6).ok).toBe(true)
  })

  it('keeps surrounding spaces, since they are part of the password', () => {
    // Trimming here would store one password and check another.
    expect(checkPassword('  mat khau  ', 8)).toEqual({ ok: true, value: '  mat khau  ' })
  })
})
