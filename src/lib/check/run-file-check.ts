/**
 * The whole check in one call: bytes in, saved run id out.
 *
 * Wires read workbook -> run rules -> persist -> keep the original file.
 *
 * Order matters. The run is written to the database first and the file is
 * stored afterwards, because a saved run with no file still shows every finding
 * on screen, while a stored file with no run shows nothing at all. So a failing
 * disk costs the export button, not the result.
 */

import { readPromotionWorkbook } from '@/lib/excel/promotion-workbook'
import { checkWorkbook } from '@/lib/rules/run-check'
import { attachStoredFile, saveCheckRun } from './check-run-store'
import { buildStoredFileName, saveUploadedFile } from './upload-storage'

export type FileCheckResult = {
  runId: string
  /** null when the upload could not be kept - the export screen says so. */
  storedFileName: string | null
}

export async function runFileCheck(bytes: Uint8Array, fileName: string): Promise<FileCheckResult> {
  const workbook = await readPromotionWorkbook(bytes, fileName)
  const { catalogSyncedAt, ...result } = await checkWorkbook(workbook)

  const runId = await saveCheckRun({ workbook, result, catalogSyncedAt, storedFileName: null })

  const storedFileName = buildStoredFileName(runId, fileName)
  try {
    await saveUploadedFile(storedFileName, bytes)
    await attachStoredFile(runId, storedFileName)
    return { runId, storedFileName }
  } catch (error) {
    // Logged, never thrown: the check itself succeeded and the user must see it.
    console.error('[check] không lưu được file gốc, sẽ không xuất báo cáo được', error)
    return { runId, storedFileName: null }
  }
}
