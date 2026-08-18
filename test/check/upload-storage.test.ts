/**
 * The stored file name is built from user input and read back from the
 * database, so it is the one string in this feature that could turn into an
 * arbitrary file path. These tests are about that, not about tidiness.
 */

import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildStoredFileName,
  readUploadedFile,
  resolveUploadPath,
  uploadDir,
} from '@/lib/check/upload-storage'

const ORIGINAL_UPLOAD_DIR = process.env.UPLOAD_DIR

beforeEach(() => {
  process.env.UPLOAD_DIR = path.resolve('.test-uploads')
})

afterEach(() => {
  if (ORIGINAL_UPLOAD_DIR === undefined) delete process.env.UPLOAD_DIR
  else process.env.UPLOAD_DIR = ORIGINAL_UPLOAD_DIR
})

describe('naming the stored copy of an upload', () => {
  it('keeps the run id so the file traces back to its run', () => {
    expect(buildStoredFileName('run123', 'promotion.t8.xlsx')).toBe('run123-promotion-t8.xlsx')
  })

  it('always ends in .xlsx whatever came in', () => {
    expect(buildStoredFileName('r1', 'khuyen-mai.xls')).toBe('r1-khuyen-mai.xlsx')
  })

  it('strips any directory the browser reported', () => {
    const name = buildStoredFileName('r1', '../../etc/passwd.xlsx')
    expect(name).toBe('r1-passwd.xlsx')
    expect(name).not.toContain('..')
    expect(name).not.toContain('/')
  })

  it('reduces Vietnamese and punctuation to plain characters', () => {
    expect(buildStoredFileName('r1', 'Khuyến mãi tháng 8 (bản 2).xlsx')).toBe(
      'r1-Khuy-n-m-i-th-ng-8-b-n-2.xlsx',
    )
  })

  it('still produces a usable name when nothing survives the cleanup', () => {
    expect(buildStoredFileName('r1', '???.xlsx')).toBe('r1-file.xlsx')
  })

  it('bounds the length so it cannot blow past a path limit', () => {
    const name = buildStoredFileName('r1', `${'a'.repeat(500)}.xlsx`)
    expect(name.length).toBeLessThanOrEqual(3 + 60 + 5)
  })
})

describe('resolving a stored name back to a path', () => {
  it('stays inside the upload directory', () => {
    const resolved = resolveUploadPath('run1-file.xlsx')
    expect(resolved).not.toBeNull()
    expect(resolved!.startsWith(uploadDir())).toBe(true)
  })

  it('refuses a name that climbs out of the directory', () => {
    expect(resolveUploadPath('../../../etc/passwd')).toBeNull()
    expect(resolveUploadPath(path.resolve('/etc/passwd'))).toBeNull()
  })

  it('reads nothing rather than throwing when the file is gone', async () => {
    await expect(readUploadedFile('run-that-was-pruned.xlsx')).resolves.toBeNull()
    await expect(readUploadedFile(null)).resolves.toBeNull()
    await expect(readUploadedFile('../../secret')).resolves.toBeNull()
  })
})
