import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

/**
 * Lazily created singleton Prisma client.
 *
 * Prisma 7 connects through a driver adapter, so the connection string is read
 * here rather than from schema.prisma.
 *
 * The client is built on first property access, not at import time: `next build`
 * and unit tests import modules that touch this file while no database is
 * reachable, and an eager `new PrismaClient()` would open a pool (or throw on a
 * missing DATABASE_URL) during the build.
 *
 * Next.js dev mode reloads modules on every change; without the global cache
 * each reload would open a brand new pool of database connections.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('Thiếu biến môi trường DATABASE_URL. Xem file .env.example.')
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export function getPrismaClient(): PrismaClient {
  const client = globalForPrisma.prisma ?? createPrismaClient()
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client
  }
  return client
}

/** Behaves like a PrismaClient instance but defers construction to first use. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient()
    const value = Reflect.get(client, property)
    // Keep `this` pointing at the real client, not at the proxy.
    return typeof value === 'function' ? value.bind(client) : value
  },
})
