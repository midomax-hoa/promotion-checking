import { describe, expect, it } from 'vitest'
import { remainingLockMinutes } from '@/lib/auth/login'
import { sessionCookieAttributes } from '@/lib/auth/session-cookie'
import { createSessionToken, hashSessionToken } from '@/lib/auth/session-token'

describe('createSessionToken', () => {
  it('never repeats itself', () => {
    const tokens = new Set(Array.from({ length: 200 }, createSessionToken))
    expect(tokens.size).toBe(200)
  })

  it('is url-safe, so it needs no escaping in a cookie', () => {
    expect(createSessionToken()).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('hashSessionToken', () => {
  it('maps the same token to the same lookup key every time', () => {
    const token = createSessionToken()
    expect(hashSessionToken(token)).toBe(hashSessionToken(token))
  })

  it('does not carry the token itself into the database', () => {
    const token = createSessionToken()
    const hash = hashSessionToken(token)
    expect(hash).not.toContain(token)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('gives two tokens two different keys', () => {
    expect(hashSessionToken(createSessionToken())).not.toBe(hashSessionToken(createSessionToken()))
  })
})

describe('sessionCookieAttributes', () => {
  it('keeps the cookie away from JavaScript and from other sites', () => {
    const attributes = sessionCookieAttributes()
    expect(attributes.httpOnly).toBe(true)
    expect(attributes.sameSite).toBe('lax')
    expect(attributes.path).toBe('/')
  })

  it('passes the expiry through when one is given', () => {
    const expires = new Date('2026-09-01T00:00:00Z')
    expect(sessionCookieAttributes(expires).expires).toBe(expires)
  })
})

describe('remainingLockMinutes', () => {
  const now = Date.parse('2026-08-19T10:00:00Z')

  it('is zero when nothing is locked', () => {
    expect(remainingLockMinutes(null, now)).toBe(0)
  })

  it('is zero once the lock has passed', () => {
    expect(remainingLockMinutes(new Date(now - 60_000), now)).toBe(0)
  })

  it('rounds up, so it never reads as "any moment now"', () => {
    // 30 seconds left has to be reported as a minute, not as zero.
    expect(remainingLockMinutes(new Date(now + 30_000), now)).toBe(1)
    expect(remainingLockMinutes(new Date(now + 14 * 60_000 + 1_000), now)).toBe(15)
  })
})
