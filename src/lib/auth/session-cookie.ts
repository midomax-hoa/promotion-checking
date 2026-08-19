/**
 * The cookie the session token travels in.
 *
 * Split away from `session-token.ts` because the middleware imports this and
 * runs on the Edge runtime, where `node:crypto` does not exist - importing the
 * token module there fails the whole app at build time, every route included.
 * Nothing here may gain a Node-only import.
 */

export const SESSION_COOKIE_NAME = 'pc_session'

export type SessionCookieAttributes = {
  httpOnly: true
  sameSite: 'lax'
  secure: boolean
  path: '/'
  expires?: Date
}

/**
 * `sameSite: 'lax'` rather than `'strict'`: strict would drop the cookie when an
 * operator follows a link to the tool from a chat message, landing them on the
 * login screen even though they are signed in.
 */
export function sessionCookieAttributes(expires?: Date): SessionCookieAttributes {
  return {
    httpOnly: true,
    sameSite: 'lax',
    // Deployment terminates TLS at Caddy, so production is always https.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(expires ? { expires } : {}),
  }
}
