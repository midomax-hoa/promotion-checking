/**
 * MinIO (S3-compatible) object storage for the uploaded workbooks.
 *
 * The files are business data - cost prices and selling prices - so they are
 * never made public. Nothing here builds a browsable URL: the bytes are read
 * back server-side by the export and reconcile paths, behind the session check.
 * That is also why `MINIO_PUBLIC_URL` is deliberately not read.
 *
 * Storage is production-only and optional. Outside `NODE_ENV=production`, or
 * with `MINIO_ENDPOINT` blank, the whole module reports itself disabled and
 * `upload-storage.ts` keeps writing to the local folder - so a developer
 * machine and the test suite need no MinIO at all, and a `.env` copied down
 * from the server still cannot push a scratch file into the shared bucket.
 */

import { Client } from 'minio'
import { z } from 'zod'

/** Env, not AppSetting: these are credentials, and the config screen is operator-facing. */
const CONFIG_SCHEMA = z.object({
  endPoint: z.string().min(1),
  port: z.coerce.number().int().positive().max(65535).default(9000),
  accessKey: z.string().min(1),
  secretKey: z.string().min(1),
  bucket: z.string().min(1),
  useSSL: z.boolean(),
  /**
   * Folder inside the bucket. Configurable so the deployment can file the
   * uploads wherever its bucket layout wants them - a bucket shared with
   * another project needs a corner of its own, a dedicated one does not.
   *
   * Never empty: `isKeyInsidePrefix` is the guard that stops a hand-edited
   * database row from reading an arbitrary object, and an empty prefix would
   * match everything.
   */
  prefix: z.string().min(1),
})

export type ObjectStorageConfig = z.infer<typeof CONFIG_SCHEMA>

const DEFAULT_PREFIX = 'uploads'

/**
 * Field name back to the variable the operator actually edits. Without it the
 * failure reads "Invalid input: expected string", which says nothing about
 * which line of `.env.production` is at fault.
 */
const ENV_NAME: Record<string, string> = {
  endPoint: 'MINIO_ENDPOINT',
  port: 'MINIO_PORT',
  accessKey: 'MINIO_ACCESS_KEY',
  secretKey: 'MINIO_SECRET_KEY',
  bucket: 'MINIO_BUCKET',
  useSSL: 'MINIO_USE_SSL',
  prefix: 'MINIO_PREFIX',
}

function trimmed(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

/**
 * MinIO is for the deployed application only. Anywhere else - `next dev`, the
 * test suite, a script - the upload goes to the local folder even when the
 * credentials happen to be present in `.env`, so a developer trying something
 * out cannot drop a file into the shared bucket by accident.
 */
export function isObjectStorageEnabled(): boolean {
  return process.env.NODE_ENV === 'production' && trimmed('MINIO_ENDPOINT') !== undefined
}

/**
 * null = storage switched off (not production, or no endpoint configured),
 * which is a supported setup rather than a fault. A half-filled configuration
 * throws instead: it is always a mistake, and silently writing to disk would
 * hide it until the day someone goes looking for the files in the bucket.
 */
export function objectStorageConfig(): ObjectStorageConfig | null {
  if (!isObjectStorageEnabled()) return null

  const parsed = CONFIG_SCHEMA.safeParse({
    endPoint: trimmed('MINIO_ENDPOINT'),
    port: trimmed('MINIO_PORT') ?? 9000,
    accessKey: trimmed('MINIO_ACCESS_KEY'),
    secretKey: trimmed('MINIO_SECRET_KEY'),
    bucket: trimmed('MINIO_BUCKET'),
    // Anything but an explicit "true" is off, so a typo cannot silently ask for
    // TLS the server does not speak.
    useSSL: trimmed('MINIO_USE_SSL')?.toLowerCase() === 'true',
    prefix: normalizePrefix(trimmed('MINIO_PREFIX') ?? DEFAULT_PREFIX),
  })
  if (!parsed.success) {
    const reasons = parsed.error.issues
      .map((issue) => {
        const field = String(issue.path[0])
        return `${ENV_NAME[field] ?? field} thiếu hoặc không hợp lệ`
      })
      .join('; ')
    throw new Error(`Cấu hình MinIO chưa đủ: ${reasons}`)
  }
  return parsed.data
}

/** No leading or trailing slash, so joining is always `${prefix}/${rest}`. */
function normalizePrefix(value: string): string {
  return value.replace(/^\/+|\/+$/g, '')
}

/**
 * Rebuilt per call rather than held in a module singleton, because the config
 * is read from env every time; the client itself is cached so repeated uploads
 * do not re-open a connection pool.
 */
let cached: { key: string; client: Client } | null = null

function clientFor(config: ObjectStorageConfig): Client {
  const key = JSON.stringify(config)
  if (cached?.key !== key) {
    cached = {
      key,
      client: new Client({
        endPoint: config.endPoint,
        port: config.port,
        useSSL: config.useSSL,
        accessKey: config.accessKey,
        secretKey: config.secretKey,
      }),
    }
  }
  return cached.client
}

/**
 * `{prefix}/{year}/{month}/{fileName}`.
 *
 * Split by month so a bucket holding years of uploads can still be listed, and
 * so a retention sweep can work a folder at a time (see docs - not automated yet).
 */
export function buildObjectKey(fileName: string, at: Date = new Date()): string {
  const config = objectStorageConfig()
  const prefix = config ? config.prefix : DEFAULT_PREFIX
  const year = String(at.getFullYear())
  const month = String(at.getMonth() + 1).padStart(2, '0')
  return `${prefix}/${year}/${month}/${fileName}`
}

/**
 * Belt and braces, mirroring `resolveUploadPath` on the disk side: the key
 * travels through the database, so a row edited by hand must not turn into a
 * read of somebody else's object in a shared bucket.
 */
export function isKeyInsidePrefix(key: string, config: ObjectStorageConfig): boolean {
  return key.startsWith(`${config.prefix}/`) && !key.includes('..')
}

export async function putObject(key: string, bytes: Uint8Array): Promise<void> {
  const config = objectStorageConfig()
  if (config === null) throw new Error('Chưa cấu hình MinIO, không lưu được file lên kho đối tượng.')
  if (!isKeyInsidePrefix(key, config)) throw new Error(`Khoá đối tượng không hợp lệ: ${key}`)

  await clientFor(config).putObject(config.bucket, key, Buffer.from(bytes), bytes.byteLength, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** null = gone, unreadable, or storage switched off - all "file no longer available". */
export async function getObject(key: string): Promise<Buffer | null> {
  const config = objectStorageConfig()
  if (config === null || !isKeyInsidePrefix(key, config)) return null

  try {
    const stream = await clientFor(config).getObject(config.bucket, key)
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk as Buffer)
    return Buffer.concat(chunks)
  } catch (error) {
    console.error('[storage] không đọc được đối tượng', key, error)
    return null
  }
}
