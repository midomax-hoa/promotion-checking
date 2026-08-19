import { NextResponse, type NextRequest } from 'next/server'
import { LOGIN_PATH, NEXT_PARAM, isPublicPath } from '@/lib/auth/auth-routes'
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie'

/**
 * First gate: turns visitors without a session cookie away before a page is even
 * rendered.
 *
 * It only checks that the cookie exists. Middleware runs on the Edge runtime,
 * which has no database access, so whether the cookie is genuine is decided
 * later by `requireUser()` inside each page, route and server action. This layer
 * exists for the redirect, not for the security - never remove the inner check
 * on the grounds that "middleware already handles it".
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl
  if (isPublicPath(pathname)) return NextResponse.next()
  if (request.cookies.has(SESSION_COOKIE_NAME)) return NextResponse.next()

  // An API call gets a status it can act on; a redirect to HTML would surface in
  // the browser as an unreadable parse error instead of "please sign in".
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Cần đăng nhập để dùng chức năng này.' }, { status: 401 })
  }

  const loginUrl = new URL(LOGIN_PATH, request.url)
  loginUrl.searchParams.set(NEXT_PARAM, pathname + search)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  /**
   * Everything except Next's own assets and the favicon. Those are served
   * before any session exists - gating them would leave the login screen
   * unstyled and without its icon.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
