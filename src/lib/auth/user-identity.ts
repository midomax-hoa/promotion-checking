/**
 * How a username and an email are spelled, in one place.
 *
 * Shared by login, the seed and the `user:*` commands, so an account created
 * from the terminal is guaranteed to be findable by the login screen - the two
 * must normalise identically or the account simply never matches.
 *
 * Pure: no database, no config reads, so it is testable on its own.
 */

/** Letters, digits and the three separators people actually type in a login name. */
const USERNAME_PATTERN = /^[a-z0-9._-]+$/
const USERNAME_MIN = 3
const USERNAME_MAX = 32

/**
 * Deliberately loose. Full RFC 5322 validation rejects addresses that real mail
 * servers accept, and the address here is a login identifier - it is never sent
 * to, so a typo costs one failed login rather than a lost message.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_MAX = 254

/**
 * Lower-cased so "Hoa" and "hoa" are the same account.
 *
 * NFKC first: a name typed with a Vietnamese IME can carry the same letter in
 * two different Unicode spellings, which would store as two distinct usernames
 * that look identical on screen.
 */
export function normalizeUsername(raw: string): string {
  return raw.normalize('NFKC').trim().toLowerCase()
}

export function normalizeEmail(raw: string): string {
  return raw.normalize('NFKC').trim().toLowerCase()
}

export type IdentityCheck = { ok: true; value: string } | { ok: false; message: string }

export function checkUsername(raw: string): IdentityCheck {
  const value = normalizeUsername(raw)
  if (value.length < USERNAME_MIN || value.length > USERNAME_MAX) {
    return { ok: false, message: `Tên đăng nhập phải dài từ ${USERNAME_MIN} đến ${USERNAME_MAX} ký tự.` }
  }
  if (!USERNAME_PATTERN.test(value)) {
    return {
      ok: false,
      message: 'Tên đăng nhập chỉ được dùng chữ không dấu, số, dấu chấm, gạch dưới và gạch ngang.',
    }
  }
  return { ok: true, value }
}

export function checkEmail(raw: string): IdentityCheck {
  const value = normalizeEmail(raw)
  if (value.length > EMAIL_MAX) return { ok: false, message: 'Email quá dài.' }
  if (!EMAIL_PATTERN.test(value)) return { ok: false, message: 'Email không đúng định dạng.' }
  return { ok: true, value }
}

/**
 * The minimum length is an operator setting rather than a constant here, so the
 * caller passes it in - this module stays free of database reads.
 */
export function checkPassword(raw: string, minLength: number): IdentityCheck {
  // Not trimmed: a leading or trailing space is a legitimate part of a password,
  // and silently removing it would make the password unrepeatable.
  if (raw.length < minLength) {
    return { ok: false, message: `Mật khẩu phải dài ít nhất ${minLength} ký tự.` }
  }
  return { ok: true, value: raw }
}
