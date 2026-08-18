/**
 * Liveness probe for the container healthcheck and for whoever is on call.
 *
 * The database lives on a separate server, so "the process is up" is not the
 * same thing as "the app works". The probe therefore touches the database and
 * answers 503 when it cannot be reached — an unreachable database is exactly
 * the failure this endpoint exists to surface.
 *
 * No table is read: `SELECT 1` proves the pool can open a connection without
 * depending on any migration having run.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', database: 'up' })
  } catch (error) {
    // The message can carry the host and credentials of the connection string,
    // so it stays in the server log and never reaches the response body.
    console.error('[health] không kết nối được CSDL', error)
    return NextResponse.json({ status: 'degraded', database: 'down' }, { status: 503 })
  }
}
