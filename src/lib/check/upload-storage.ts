/**
 * Keeps the uploaded workbook so a report can still be exported hours later,
 * from a run nobody has the original file for any more.
 *
 * Two backends, chosen by where the code is running rather than by a flag:
 *   - MinIO in production, when `MINIO_ENDPOINT` is set (the deployed setup -
 *     the files outlive the container and ride along with the bucket's backups)
 *   - the local folder everywhere else (developer machines, the test suite),
 *     whatever the `.env` happens to contain
 *
 * Three things this module refuses to do, all because the stored name travels
 * through the database and back:
 *   - trust the user's file name (it is rewritten to `[A-Za-z0-9-]` only)
 *   - trust the stored name on the way back (a disk path is checked to still
 *     sit inside the upload directory, an object key to still sit inside this
 *     project's prefix)
 *   - assume every row uses today's backend (see `isObjectKey`)
 *
 * A missing file is not an error here. Retention pruning is expected to remove
 * old files, so "gone" is a state the screen explains rather than a failure.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  buildObjectKey,
  getObject,
  isObjectStorageEnabled,
  putObject,
} from '@/lib/storage/object-storage'

/** Shown by both the export route and the result screen, so it reads the same in both places. */
export const UPLOAD_EXPIRED_MESSAGE = 'File gốc đã hết hạn lưu, tải lên lại để xuất báo cáo.'

/** Long enough to recognise the file, short enough to stay well under any path limit. */
const MAX_SLUG_LENGTH = 60

export function uploadDir(): string {
  const configured = process.env.UPLOAD_DIR?.trim()
  return configured ? path.resolve(configured) : path.resolve(process.cwd(), '.uploads')
}

/**
 * `{runId}-{slug}.xlsx`. The runId is a cuid, so the name is unique and traces
 * straight back to its `CheckRun` row.
 */
export function buildStoredFileName(runId: string, originalName: string): string {
  const base = path.basename(originalName).replace(/\.[^.]+$/, '')
  const slug = base
    .normalize('NFC')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
  return `${runId}-${slug || 'file'}.xlsx`
}

/**
 * Tells the two backends apart from the stored value alone, so runs saved
 * before MinIO was introduced keep reading from disk without a data migration.
 *
 * Safe because `buildStoredFileName` strips everything outside `[A-Za-z0-9-]`:
 * a disk name can never contain a slash, an object key always does.
 */
export function isObjectKey(storedFileName: string): boolean {
  return storedFileName.includes('/')
}

/**
 * Resolves a stored name inside the upload directory, or null when it tries to
 * escape. Belt and braces: names are sanitised on the way in, but a row edited
 * by hand must not turn into an arbitrary file read.
 */
export function resolveUploadPath(storedFileName: string): string | null {
  const directory = uploadDir()
  const resolved = path.resolve(directory, storedFileName)
  const withSeparator = directory.endsWith(path.sep) ? directory : directory + path.sep
  return resolved.startsWith(withSeparator) ? resolved : null
}

/**
 * Returns the identifier to persist on the run - an object key with MinIO, the
 * plain file name on disk. Callers must store what comes back rather than what
 * they passed in, because only the caller knows the run it belongs to.
 */
export async function saveUploadedFile(
  storedFileName: string,
  bytes: Uint8Array,
): Promise<string> {
  if (isObjectStorageEnabled()) {
    const key = buildObjectKey(storedFileName)
    await putObject(key, bytes)
    return key
  }

  const target = resolveUploadPath(storedFileName)
  if (target === null) throw new Error(`Tên file lưu trữ không hợp lệ: ${storedFileName}`)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, bytes)
  return storedFileName
}

/** null = pruned by retention, or never written because the save failed. */
export async function readUploadedFile(storedFileName: string | null): Promise<Buffer | null> {
  if (!storedFileName) return null
  if (isObjectKey(storedFileName)) return getObject(storedFileName)

  const target = resolveUploadPath(storedFileName)
  if (target === null) return null
  try {
    return await readFile(target)
  } catch {
    return null
  }
}
