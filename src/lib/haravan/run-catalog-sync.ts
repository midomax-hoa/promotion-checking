import { createHaravanClient } from './haravan-client'
import { syncCatalog, type SyncOptions, type SyncResult } from './catalog-sync'
import { prismaCatalogStore } from '@/lib/catalog/catalog-store'
import { clearCatalogIndexCache } from '@/lib/catalog/catalog-index'
import { getAppConfig } from '@/lib/config/app-config'

/**
 * Wires the real client, the real store and the database settings together.
 * Kept apart from `catalog-sync` so the paging logic stays testable without a
 * database or a network.
 */
export async function runCatalogSync(options: SyncOptions): Promise<SyncResult> {
  const config = await getAppConfig()
  const client = await createHaravanClient()
  try {
    return await syncCatalog(options, {
      client,
      store: prismaCatalogStore,
      pageSize: config.haravanPageSize,
      cursorOverlapMs: config.catalogCursorOverlapMs,
      shortfallTolerance: config.catalogShortfallTolerance,
    })
  } finally {
    // The in-memory lookup index would otherwise keep serving the old catalog.
    clearCatalogIndexCache()
  }
}
