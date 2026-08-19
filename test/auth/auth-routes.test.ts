import { describe, expect, it } from 'vitest'
import { LOGIN_PATH, isPublicPath, safeNextPath } from '@/lib/auth/auth-routes'

describe('isPublicPath', () => {
  it('lets the login screen and the healthcheck through', () => {
    expect(isPublicPath(LOGIN_PATH)).toBe(true)
    expect(isPublicPath('/api/health')).toBe(true)
  })

  it('holds back every screen that shows shop data', () => {
    for (const path of ['/', '/lich-su', '/cau-hinh', '/api/check', '/api/sync', '/ket-qua/abc']) {
      expect(isPublicPath(path)).toBe(false)
    }
  })

  it('does not treat a path that merely starts with the same letters as public', () => {
    // "/api/healthcheck-internal" is a different route and must stay closed.
    expect(isPublicPath('/api/healthcheck-internal')).toBe(false)
    expect(isPublicPath('/dang-nhap-lai')).toBe(false)
  })
})

describe('safeNextPath', () => {
  it('keeps a path on this site, query string included', () => {
    expect(safeNextPath('/lich-su')).toBe('/lich-su')
    expect(safeNextPath('/ket-qua/abc?trang=2')).toBe('/ket-qua/abc?trang=2')
  })

  it('refuses to send anyone to another site', () => {
    // A protocol-relative URL is the classic open-redirect payload: the browser
    // reads "//evil.example" as a host, not as a path on this server.
    for (const hostile of ['https://evil.example', '//evil.example', '/\\evil.example', 'evil.example']) {
      expect(safeNextPath(hostile)).toBe('/')
    }
  })

  it('falls back when the parameter is missing or empty', () => {
    expect(safeNextPath(null)).toBe('/')
    expect(safeNextPath(undefined)).toBe('/')
    expect(safeNextPath('')).toBe('/')
  })

  it('does not bounce a fresh login back to the login screen', () => {
    expect(safeNextPath(LOGIN_PATH)).toBe('/')
    expect(safeNextPath(`${LOGIN_PATH}?tiep=%2F`)).toBe('/')
  })
})
