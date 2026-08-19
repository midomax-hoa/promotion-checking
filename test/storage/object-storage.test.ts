/**
 * The object key is built from user input and read back from the database, so
 * it is the one string in this feature that could turn into a read of somebody
 * else's file in a bucket shared with other projects. These tests are about
 * that, and about the switch between the two storage backends - not tidiness.
 *
 * Nothing here talks to a real MinIO: every case either has storage switched
 * off, or stops at a guard before any request would be made.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildObjectKey,
  getObject,
  isKeyInsidePrefix,
  isObjectStorageEnabled,
  objectStorageConfig,
  putObject,
} from '@/lib/storage/object-storage'
import { isObjectKey, readUploadedFile } from '@/lib/check/upload-storage'

const MINIO_VARS = [
  'MINIO_ENDPOINT',
  'MINIO_PORT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'MINIO_BUCKET',
  'MINIO_USE_SSL',
  'MINIO_PREFIX',
] as const

const ORIGINAL = new Map(MINIO_VARS.map((name) => [name, process.env[name]]))

/**
 * Storage is production-only, so every case that expects MinIO to be in play
 * has to say so - the suite itself runs with NODE_ENV=test.
 */
function configure(
  values: Partial<Record<(typeof MINIO_VARS)[number], string>>,
  nodeEnv: 'production' | 'development' | 'test' = 'production',
): void {
  for (const name of MINIO_VARS) delete process.env[name]
  for (const [name, value] of Object.entries(values)) process.env[name] = value
  // Through vi.stubEnv because NODE_ENV is typed read-only in a Next project.
  vi.stubEnv('NODE_ENV', nodeEnv)
}

beforeEach(() => {
  configure({})
})

afterEach(() => {
  for (const [name, value] of ORIGINAL) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  vi.unstubAllEnvs()
})

const FULL_CONFIG = {
  MINIO_ENDPOINT: 'localhost',
  MINIO_PORT: '9000',
  MINIO_ACCESS_KEY: 'key',
  MINIO_SECRET_KEY: 'secret',
  MINIO_BUCKET: 'zma-assets',
  MINIO_USE_SSL: 'false',
}

describe('deciding whether object storage is in play', () => {
  it('stays switched off when no endpoint is configured', () => {
    expect(isObjectStorageEnabled()).toBe(false)
    expect(objectStorageConfig()).toBeNull()
  })

  it('stays switched off outside production even with full credentials', () => {
    // A .env copied down from the server must not let a developer drop a
    // scratch file into the bucket the deployed application writes to.
    configure(FULL_CONFIG, 'development')
    expect(isObjectStorageEnabled()).toBe(false)
    expect(objectStorageConfig()).toBeNull()
  })

  it('is on in production once the endpoint is there', () => {
    configure(FULL_CONFIG)
    expect(isObjectStorageEnabled()).toBe(true)
    expect(objectStorageConfig()?.bucket).toBe('zma-assets')
  })

  it('refuses a half-filled configuration instead of quietly writing to disk', () => {
    configure({ MINIO_ENDPOINT: 'localhost', MINIO_BUCKET: 'zma-assets' })
    expect(() => objectStorageConfig()).toThrow(/MINIO_ACCESS_KEY/)
  })

  it('only treats an explicit "true" as a request for TLS', () => {
    configure({ ...FULL_CONFIG, MINIO_USE_SSL: 'yes' })
    expect(objectStorageConfig()?.useSSL).toBe(false)
    configure({ ...FULL_CONFIG, MINIO_USE_SSL: 'true' })
    expect(objectStorageConfig()?.useSSL).toBe(true)
  })
})

describe('building the object key', () => {
  it('files the upload under this project prefix, by year and month', () => {
    configure(FULL_CONFIG)
    expect(buildObjectKey('run1-file.xlsx', new Date(2026, 7, 19))).toBe(
      'promotion-checking/uploads/2026/08/run1-file.xlsx',
    )
  })

  it('honours a configured prefix, slashes trimmed', () => {
    configure({ ...FULL_CONFIG, MINIO_PREFIX: '/kiem-tra-km/uploads/' })
    expect(buildObjectKey('run1-file.xlsx', new Date(2026, 0, 5))).toBe(
      'kiem-tra-km/uploads/2026/01/run1-file.xlsx',
    )
  })
})

describe('guarding the key on the way back', () => {
  it('accepts only keys inside the configured prefix', () => {
    configure(FULL_CONFIG)
    const config = objectStorageConfig()!
    expect(isKeyInsidePrefix('promotion-checking/uploads/2026/08/run1.xlsx', config)).toBe(true)
    expect(isKeyInsidePrefix('another-project/secrets.xlsx', config)).toBe(false)
    expect(isKeyInsidePrefix('promotion-checking/uploads/../../etc/passwd', config)).toBe(false)
  })

  it('refuses to write outside the prefix', async () => {
    configure(FULL_CONFIG)
    await expect(putObject('another-project/x.xlsx', new Uint8Array([1]))).rejects.toThrow()
  })

  it('reads nothing rather than throwing when storage is switched off', async () => {
    await expect(getObject('promotion-checking/uploads/2026/08/run1.xlsx')).resolves.toBeNull()
  })
})

describe('telling a stored object key from a stored disk name', () => {
  it('recognises the two shapes', () => {
    expect(isObjectKey('promotion-checking/uploads/2026/08/run1-file.xlsx')).toBe(true)
    // Runs saved before MinIO existed keep this shape and must still read from disk.
    expect(isObjectKey('run1-file.xlsx')).toBe(false)
  })

  it('sends an object key to storage, not to the upload directory', async () => {
    // Storage is off here, so a null proves the read never fell through to disk
    // (a disk read of this name would have been refused as escaping anyway).
    await expect(
      readUploadedFile('promotion-checking/uploads/2026/08/run1-file.xlsx'),
    ).resolves.toBeNull()
  })
})
