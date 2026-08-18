/**
 * Says how old the catalog cache is, loudly when it matters.
 *
 * The failure this guards against is quiet and expensive: a stale cache makes
 * group B report SKUs as missing that exist perfectly well, and a user who
 * trusts that result deletes good rows from their file. So the warning sits
 * above everything else, and it names the age instead of just saying "old".
 */

import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { prismaCatalogStore } from '@/lib/catalog/catalog-store'
import { getAppConfig } from '@/lib/config/app-config'

export function formatAge(ms: number): string {
  const hours = Math.floor(ms / 3_600_000)
  if (hours < 1) return `${Math.max(1, Math.floor(ms / 60_000))} phút`
  if (hours < 48) return `${hours} giờ`
  return `${Math.floor(hours / 24)} ngày`
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(value)
}

export async function CatalogFreshnessAlert({ now = new Date() }: { now?: Date }) {
  const [state, config] = await Promise.all([prismaCatalogStore.readSyncState(), getAppConfig()])
  const syncedAt = state.lastFullSyncAt
  const ageMs = syncedAt ? now.getTime() - syncedAt.getTime() : null
  const isStale = ageMs === null || ageMs > config.catalogMaxAgeHours * 3_600_000

  if (syncedAt && !isStale) {
    return (
      <p className="text-sm text-muted-foreground">
        Danh mục đồng bộ lúc {formatDateTime(syncedAt)} — còn mới.
      </p>
    )
  }

  return (
    <Alert variant="destructive">
      <AlertTitle>{syncedAt ? 'Cache danh mục đã cũ' : 'Chưa đồng bộ danh mục lần nào'}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-2">
        <span>
          {ageMs === null
            ? 'Chưa có dữ liệu danh mục, nên các luật nhóm B (kiểm tra SKU có thật trên Haravan) sẽ bị bỏ qua.'
            : `Lần đồng bộ gần nhất cách đây ${formatAge(ageMs)}, vượt ngưỡng ${config.catalogMaxAgeHours} giờ. Kết quả kiểm tra SKU có thể sai lệch.`}
        </span>
        <Link
          href="/dong-bo"
          className="rounded-md border border-current px-3 py-1 text-sm font-medium hover:underline"
        >
          Đồng bộ ngay
        </Link>
      </AlertDescription>
    </Alert>
  )
}

/** The snapshot taken when a run happened, shown on the result screen for traceability. */
export function CatalogSnapshotNote({ catalogSyncedAt }: { catalogSyncedAt: Date | null }) {
  return (
    <p className="text-xs text-muted-foreground">
      {catalogSyncedAt
        ? `Lần kiểm tra này dùng danh mục đồng bộ lúc ${formatDateTime(catalogSyncedAt)}.`
        : 'Lần kiểm tra này chạy khi chưa có danh mục, các luật nhóm B đã bị bỏ qua.'}
    </p>
  )
}
