/**
 * Which paths are reachable without logging in, and where to send everyone else.
 *
 * Pure and dependency-free: the middleware imports it, and the middleware runs
 * on the Edge runtime where Prisma and `node:crypto` are unavailable.
 */

export const LOGIN_PATH = '/dang-nhap'

/** Query parameter carrying where the visitor was headed before the login screen. */
export const NEXT_PARAM = 'tiep'

/**
 * Paths served without a session.
 *
 * `/api/health` is on the list because the container healthcheck and whatever
 * monitoring watches this service have no cookie - requiring one would report
 * a healthy app as down.
 */
const PUBLIC_PATHS: readonly string[] = [LOGIN_PATH, '/api/health']

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/'))
}

/**
 * Sanitises the `tiep` parameter before it is used as a redirect target.
 *
 * Only a path on this site is allowed. Without the check, a link to
 * `/dang-nhap?tiep=https://evil.example` would take an operator who has just
 * typed their password straight to somebody else's page - and it would look
 * like the tool sent them there.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/'): string {
  if (!raw || !raw.startsWith('/')) return fallback
  // "//host" and "/\host" are both read as protocol-relative URLs by browsers.
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  // Landing back on the login screen after logging in is a loop.
  if (raw === LOGIN_PATH || raw.startsWith(LOGIN_PATH + '?')) return fallback
  return raw
}
