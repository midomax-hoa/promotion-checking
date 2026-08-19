/**
 * Downloads the annotated copy of one run's original workbook.
 *
 * Built on demand rather than at check time: most runs are never exported, and
 * writing a 4.000 row file costs several seconds of CPU.
 */

import { UPLOAD_EXPIRED_MESSAGE, readUploadedFile } from '@/lib/check/upload-storage'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth/current-user'
import { buildReportWorkbook } from '@/lib/excel/report-exporter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** ExcelJS needs roughly 8 s to rewrite the real 3.929 row file. */
export const maxDuration = 120

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
): Promise<Response> {
  // The middleware only proves a cookie was sent; this is where it is proved
  // genuine, so a hand-crafted request cannot reach the shop's data.
  if (!(await getCurrentUser())) return unauthorizedResponse()

  const { runId } = await context.params

  const run = await prisma.checkRun.findUnique({
    where: { id: runId },
    select: {
      fileName: true,
      storedFileName: true,
      createdAt: true,
      totalSheets: true,
      totalRows: true,
      totalPrograms: true,
      countCritical: true,
      countDanger: true,
      countWarn: true,
    },
  })
  if (run == null) {
    return Response.json({ error: 'Không tìm thấy lần kiểm tra này.' }, { status: 404 })
  }

  const originalFile = await readUploadedFile(run.storedFileName)
  if (originalFile == null) {
    // 410, not 404: the run exists and its findings are still on screen.
    return Response.json({ error: UPLOAD_EXPIRED_MESSAGE }, { status: 410 })
  }

  const findings = await prisma.finding.findMany({
    where: { runId },
    select: {
      severity: true,
      sheetName: true,
      rowNumber: true,
      programName: true,
      ruleCode: true,
      message: true,
      suggestion: true,
    },
  })

  try {
    const report = await buildReportWorkbook(originalFile, run, findings)
    return new Response(new Uint8Array(report), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': contentDisposition(reportFileName(run.fileName)),
        'Content-Length': String(report.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[export] không dựng được file báo cáo', error)
    return Response.json(
      { error: 'Không dựng được file báo cáo. Xem log máy chủ để biết chi tiết.' },
      { status: 500 },
    )
  }
}

function reportFileName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'ket-qua'
  return `bao-cao-${base}.xlsx`
}

/**
 * Vietnamese file names are not Latin-1, so the plain `filename` is a stripped
 * fallback and the real one rides on `filename*` (RFC 5987).
 */
function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}
