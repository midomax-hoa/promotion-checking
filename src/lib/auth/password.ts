import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'
import { promisify } from 'node:util'

/**
 * Password hashing with scrypt from the standard library.
 *
 * scrypt rather than a plain SHA: it is deliberately slow and memory-hungry, so
 * a stolen hash cannot be brute-forced at GPU speed. Chosen over bcrypt/argon2
 * because both need a native build step, and Node already ships this one.
 */

/**
 * `scrypt` is overloaded, and promisify picks the overload without an options
 * argument - which is the only one this module ever calls. Hence the cast.
 */
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>

/**
 * Technical constants, not business settings: they are baked into every stored
 * hash, so changing them cannot be a runtime toggle - old hashes must keep
 * verifying with the parameters they were written with, which is why the stored
 * string carries its own copy of all three.
 *
 * N=16384 costs roughly 16 MB and tens of milliseconds per verification, the
 * interactive-login baseline Node's own documentation uses.
 */
const COST = 16_384
const BLOCK_SIZE = 8
const PARALLELISM = 1
const KEY_LENGTH = 64
const SALT_LENGTH = 16

const PREFIX = 'scrypt'
const SEPARATOR = '$'

/** Produces `scrypt$N$r$p$salt$hash`, salt and hash in base64. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const derived = await derive(password, salt)
  return [
    PREFIX,
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join(SEPARATOR)
}

/**
 * Never throws on a malformed stored hash: a corrupted row means "this password
 * does not match", not a 500 that tells the caller the account exists.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStoredHash(stored)
  if (!parsed) return false

  let derived: Buffer
  try {
    derived = await derive(password, parsed.salt, parsed)
  } catch {
    // Out-of-range parameters make scrypt throw rather than return.
    return false
  }
  if (derived.length !== parsed.hash.length) return false
  // Constant time: a byte-by-byte compare leaks how much of the hash matched.
  return timingSafeEqual(derived, parsed.hash)
}

type ScryptParams = { cost: number; blockSize: number; parallelism: number }

const CURRENT_PARAMS: ScryptParams = {
  cost: COST,
  blockSize: BLOCK_SIZE,
  parallelism: PARALLELISM,
}

async function derive(
  password: string,
  salt: Buffer,
  params: ScryptParams = CURRENT_PARAMS,
): Promise<Buffer> {
  // NFKC so a password typed with a Vietnamese IME still matches one typed with
  // another: the same accented letter has more than one Unicode spelling.
  return scryptAsync(password.normalize('NFKC'), salt, KEY_LENGTH, {
    N: params.cost,
    r: params.blockSize,
    p: params.parallelism,
    // Node's default ceiling is 32 MB, which a hash written with a higher cost
    // would exceed - it must stay verifiable rather than throw.
    maxmem: 256 * 1024 * 1024,
  })
}

function parseStoredHash(stored: string): (ScryptParams & { salt: Buffer; hash: Buffer }) | null {
  const parts = stored.split(SEPARATOR)
  if (parts.length !== 6 || parts[0] !== PREFIX) return null

  const numbers = parts.slice(1, 4).map(Number)
  if (numbers.some((value) => !Number.isInteger(value) || value <= 0)) return null

  const salt = Buffer.from(parts[4], 'base64')
  const hash = Buffer.from(parts[5], 'base64')
  if (salt.length === 0 || hash.length === 0) return null

  return {
    cost: numbers[0],
    blockSize: numbers[1],
    parallelism: numbers[2],
    salt,
    hash,
  }
}
