/**
 * Receives an uploaded workbook, runs every check and saves the result.
 *
 * The response is just the run id: the browser then navigates to the result
 * page, which renders server-side. Nothing about the findings travels through
 * this route's JSON, so a 4.000 row file does not become a 4.000 row payload.
 */

import { NextResponse } from 'next/server'
import { runFileCheck } from '@/lib/check/run-file-check'
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth/current-user'
import { InvalidWorkbookError } from '@/lib/excel/promotion-workbook'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '@/lib/excel/upload-limits'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** Reading a 20 MB workbook and running 31 rules over it outlasts the default budget. */
export const maxDuration = 120

function tooLarge(): Response {
  return NextResponse.json({ error: `Tệp vượt quá giới hạn ${MAX_UPLOAD_MB} MB.` }, { status: 413 })
}

export async function POST(request: Request): Promise<Response> {
  // The middleware only proves a cookie was sent; this is where it is proved
  // genuine, so a hand-crafted request cannot reach the shop's data.
  if (!(await getCurrentUser())) return unauthorizedResponse()

  // A cross-site multipart post is a simple request, so without this check any
  // page on the internet could make this server parse files on its behalf.
  const fetchSite = request.headers.get('Sec-Fetch-Site')
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 403 })
  }

  // Checked before the body is touched. `formData()` parses and materialises
  // every part, so a size check after it has already cost the memory it was
  // meant to save - a 2 GB post would OOM the process before reaching line 2.
  const declaredSize = Number(request.headers.get('Content-Length'))
  if (Number.isFinite(declaredSize) && declaredSize > MAX_UPLOAD_BYTES) {
    return tooLarge()
  }

  let file: File
  try {
    const form = await request.formData()
    const candidate = form.get('file')
    if (!(candidate instanceof File)) {
      return NextResponse.json({ error: 'Chưa chọn file để kiểm tra.' }, { status: 400 })
    }
    file = candidate
  } catch {
    return NextResponse.json({ error: 'Không đọc được dữ liệu tải lên.' }, { status: 400 })
  }

  // Backstop for a request that lied about, or omitted, its Content-Length.
  if (file.size > MAX_UPLOAD_BYTES) return tooLarge()

  const bytes = new Uint8Array(await file.arrayBuffer())

  try {
    // The file signature is verified inside readPromotionWorkbook, on the bytes
    // rather than the extension.
    const { runId } = await runFileCheck(bytes, file.name)
    // Only the run id: the stored file name is internal disk naming and has no
    // business leaving the server.
    return NextResponse.json({ runId }, { status: 201 })
  } catch (error) {
    if (error instanceof InvalidWorkbookError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    // Anything else carries infrastructure detail; it stays in the server log.
    console.error('[check] kiểm tra file thất bại', error)
    return NextResponse.json(
      { error: 'Kiểm tra file thất bại. Xem log máy chủ để biết chi tiết.' },
      { status: 500 },
    )
  }
}
