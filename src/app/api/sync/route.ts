import { NextResponse } from 'next/server'
import { CatalogSyncError, type SyncResult } from '@/lib/haravan/catalog-sync'
import { runCatalogSync } from '@/lib/haravan/run-catalog-sync'
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth/current-user'
import {
  HaravanApiError,
  HaravanBlankQueryError,
  HaravanNetworkError,
  HaravanRawQueryError,
  HaravanTokenMissingError,
} from '@/lib/haravan/haravan-errors'

/**
 * Runs a catalog sync and streams progress back as NDJSON (one JSON object per
 * line). A full sync of a few thousand products takes tens of seconds, and a
 * plain JSON response would leave the screen blank the whole time.
 *
 * Read-only towards Haravan: this route never writes anything to the shop.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** One sync at a time per server process: two runs would fight over the cache rows. */
let syncRunning = false

export async function POST(request: Request): Promise<Response> {
  // The middleware only proves a cookie was sent; this is where it is proved
  // genuine, so a hand-crafted request cannot reach the shop's data.
  if (!(await getCurrentUser())) return unauthorizedResponse()

  // A cross-site form post is a simple request, so it would otherwise be able to
  // burn the Haravan rate limit without ever reading the answer.
  const fetchSite = request.headers.get('Sec-Fetch-Site')
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 403 })
  }

  const full = await readFullFlag(request)

  if (syncRunning) {
    return NextResponse.json(
      { error: 'Đang có một lượt đồng bộ chạy dở. Chờ chạy xong rồi thử lại.' },
      { status: 409 },
    )
  }
  syncRunning = true

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let clientGone = false
      // Closing the tab makes enqueue throw. The sync must finish anyway,
      // otherwise the cache is left half rewritten with no state saved.
      const send = (payload: unknown) => {
        if (clientGone) return
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
        } catch {
          clientGone = true
        }
      }
      try {
        send({ type: 'start', full })
        const result = await runCatalogSync({
          full,
          onProgress: (progress) => send({ type: 'progress', ...progress }),
        })
        send({ type: 'done', result: serializeResult(result) })
      } catch (error) {
        // The full stack and the cause chain stay here, on the server.
        console.error('[sync] đồng bộ danh mục thất bại', error)
        send({
          type: 'error',
          message: toUserMessage(error),
          page: error instanceof CatalogSyncError ? error.page : null,
        })
      } finally {
        syncRunning = false
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

async function readFullFlag(request: Request): Promise<boolean> {
  try {
    const body = (await request.json()) as { full?: unknown }
    return body?.full === true
  } catch {
    return false
  }
}

function serializeResult(result: SyncResult) {
  return {
    ...result,
    startedAt: result.startedAt.toISOString(),
    finishedAt: result.finishedAt.toISOString(),
    cursor: result.cursor?.toISOString() ?? null,
    durationMs: result.finishedAt.getTime() - result.startedAt.getTime(),
  }
}

/**
 * Only errors written for this tool are forwarded verbatim. Anything else - a
 * Prisma or driver failure, say - carries infrastructure details such as the
 * database host, so it is replaced by a generic line and left in the log.
 */
const SAFE_ERRORS = [
  CatalogSyncError,
  HaravanApiError,
  HaravanNetworkError,
  HaravanTokenMissingError,
  HaravanBlankQueryError,
  HaravanRawQueryError,
] as const

function toUserMessage(error: unknown): string {
  if (error instanceof CatalogSyncError) {
    const cause = error.cause
    const detail = cause instanceof Error ? ` Nguyên nhân: ${cause.message}` : ''
    return `${error.message}${detail}`
  }
  if (SAFE_ERRORS.some((type) => error instanceof type)) return (error as Error).message
  return 'Đồng bộ thất bại. Xem log máy chủ để biết chi tiết.'
}
