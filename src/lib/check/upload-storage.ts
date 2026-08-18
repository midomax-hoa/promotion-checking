/**
 * Keeps the uploaded workbook on disk so a report can still be exported hours
 * later, from a run nobody has the original file for any more.
 *
 * Two things this module refuses to do, both because the stored name travels
 * through the database and back:
 *   - trust the user's file name (it is rewritten to `[A-Za-z0-9-]` only)
 *   - trust the stored name on the way back (the resolved path is checked to
 *     still sit inside the upload directory before anything is read)
 *
 * A missing file is not an error here. Retention pruning lands in phase 08
 * (`scripts/prune-uploads.sh`, not written yet), so "gone" is an expected state
 * the screen explains rather than a failure.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

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

export async function saveUploadedFile(storedFileName: string, bytes: Uint8Array): Promise<void> {
  const target = resolveUploadPath(storedFileName)
  if (target === null) throw new Error(`Tên file lưu trữ không hợp lệ: ${storedFileName}`)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, bytes)
}

/** null = pruned by retention, or never written because the disk write failed. */
export async function readUploadedFile(storedFileName: string | null): Promise<Buffer | null> {
  if (!storedFileName) return null
  const target = resolveUploadPath(storedFileName)
  if (target === null) return null
  try {
    return await readFile(target)
  } catch {
    return null
  }
}
