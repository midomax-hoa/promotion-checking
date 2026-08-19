import { createHash, randomBytes } from 'node:crypto'

/**
 * The random token that identifies one logged-in browser.
 *
 * Node-only: `node:crypto` is unavailable on the Edge runtime, so the middleware
 * must import `session-cookie.ts` instead of this file.
 */

/**
 * 32 bytes from the OS random source. Long enough that guessing one is not a
 * strategy, short enough to stay well inside the 4 KB cookie budget.
 */
const TOKEN_BYTES = 32

export function createSessionToken(): string {
  // base64url: safe in a cookie value without any escaping.
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

/**
 * What actually goes in the database.
 *
 * A plain SHA-256 with no salt on purpose: the input is 256 bits of randomness,
 * so there is no dictionary to defend against, and the lookup has to be a single
 * indexed equality match. The point is only that a leaked table yields hashes
 * nobody can turn back into a working cookie.
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
