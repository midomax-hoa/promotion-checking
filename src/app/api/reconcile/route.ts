/**
 * Runs a reconciliation and streams progress back as NDJSON.
 *
 * Streaming is not decoration here. A run fetches the promotion list twice with
 * a deliberate wait in between, so a plain JSON response would leave the screen
 * blank for the better part of ten seconds with nothing to say why.
 *
 * Read-only towards Haravan: this route only ever issues GET.
 */

import { NextResponse } from 'next/server'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '@/lib/excel/upload-limits'
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth/current-user'
import { InvalidWorkbookError } from '@/lib/excel/promotion-workbook'
import { PromotionFetchError } from '@/lib/haravan/promotion-fetcher'
import {
  HaravanApiError,
  HaravanBlankQueryError,
  HaravanNetworkError,
  HaravanRawQueryError,
  HaravanTokenMissingError,
} from '@/lib/haravan/haravan-errors'
import {
  runReconcile,
  SourceFileMissingError,
  type ReconcileSource,
} from '@/lib/reconcile/run-reconcile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** Two fetches, a wait between them and 154 programs to compare outlast the default budget. */
export const maxDuration = 180

/** One at a time per process: two runs would burn the Haravan rate limit against each other. */
let reconcileRunning = false

function badRequest(message: string, status = 400): Response {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Reads the source out of the multipart body: either an uploaded workbook or
 * the id of a run whose file is already on disk.
 */
async function readSource(request: Request): Promise<ReconcileSource | Response> {
  const declaredSize = Number(request.headers.get('Content-Length'))
  if (Number.isFinite(declaredSize) && declaredSize > MAX_UPLOAD_BYTES) {
    return badRequest(`Tệp vượt quá giới hạn ${MAX_UPLOAD_MB} MB.`, 413)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return badRequest('Không đọc được dữ liệu gửi lên.')
  }

  const runId = form.get('runId')
  if (typeof runId === 'string' && runId.trim().length > 0) {
    return { kind: 'previous-run', runId: runId.trim() }
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return badRequest('Chọn một lần kiểm tra trước đó, hoặc tải file Excel lên.')
  }
  // Backstop for a request that lied about, or omitted, its Content-Length.
  if (file.size > MAX_UPLOAD_BYTES) {
    return badRequest(`Tệp vượt quá giới hạn ${MAX_UPLOAD_MB} MB.`, 413)
  }
  return { kind: 'upload', bytes: new Uint8Array(await file.arrayBuffer()), fileName: file.name }
}

export async function POST(request: Request): Promise<Response> {
  // The middleware only proves a cookie was sent; this is where it is proved
  // genuine, so a hand-crafted request cannot reach the shop's data.
  if (!(await getCurrentUser())) return unauthorizedResponse()

  // A cross-site multipart post is a simple request, so without this check any
  // page on the internet could spend this shop's Haravan rate limit.
  const fetchSite = request.headers.get('Sec-Fetch-Site')
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return badRequest('Yêu cầu không hợp lệ.', 403)
  }

  const source = await readSource(request)
  if (source instanceof Response) return source

  if (reconcileRunning) {
    return badRequest('Đang có một lượt đối soát chạy dở. Chờ chạy xong rồi thử lại.', 409)
  }
  reconcileRunning = true

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let clientGone = false
      // Closing the tab makes enqueue throw. The run must finish anyway so its
      // result is saved and re-openable from the history.
      const send = (payload: unknown) => {
        if (clientGone) return
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
        } catch {
          clientGone = true
        }
      }
      try {
        send({ type: 'start' })
        const result = await runReconcile(source, (progress) => send(progress))
        send({ type: 'done', result })
      } catch (error) {
        // The full stack and the cause chain stay here, on the server.
        console.error('[reconcile] đối soát thất bại', error)
        send({ type: 'error', message: toUserMessage(error) })
      } finally {
        reconcileRunning = false
        try {
          controller.close()
        } catch {
          // Already closed by the client disconnecting.
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      // Progress must arrive line by line, not in one buffered chunk.
      'X-Accel-Buffering': 'no',
    },
  })
}

/**
 * Only errors written for this tool are forwarded verbatim. Anything else - a
 * Prisma or driver failure, say - carries infrastructure details such as the
 * database host, so it is replaced by a generic line and left in the log.
 */
const SAFE_ERRORS = [
  SourceFileMissingError,
  InvalidWorkbookError,
  PromotionFetchError,
  HaravanApiError,
  HaravanNetworkError,
  HaravanTokenMissingError,
  HaravanBlankQueryError,
  HaravanRawQueryError,
] as const

function toUserMessage(error: unknown): string {
  if (error instanceof PromotionFetchError) {
    const cause = error.cause
    const detail = cause instanceof Error ? ` Nguyên nhân: ${cause.message}` : ''
    return `${error.message}${detail}`
  }
  if (SAFE_ERRORS.some((type) => error instanceof type)) return (error as Error).message
  return 'Đối soát thất bại. Xem log máy chủ để biết chi tiết.'
}
