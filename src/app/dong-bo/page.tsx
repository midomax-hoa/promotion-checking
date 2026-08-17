import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getAppConfig } from '@/lib/config/app-config'
import { prismaCatalogStore } from '@/lib/catalog/catalog-store'
import { SyncRunner } from './sync-runner'

/**
 * Screen 3 - catalog sync.
 *
 * Server Component: the numbers are read straight from the database, so the
 * browser never receives the Haravan token or the whole catalog.
 */

export const dynamic = 'force-dynamic'

export default async function CatalogSyncPage() {
  const [state, config] = await Promise.all([prismaCatalogStore.readSyncState(), getAppConfig()])
  const staleAfterMs = config.catalogMaxAgeHours * 60 * 60 * 1000
  const ageMs = state.lastFullSyncAt ? Date.now() - state.lastFullSyncAt.getTime() : null
  const isStale = ageMs === null || ageMs > staleAfterMs

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Đồng bộ danh mục</h1>
        <p className="text-sm text-muted-foreground">
          Kéo toàn bộ sản phẩm và biến thể từ Haravan về cache. Việc kiểm tra SKU tồn tại đọc cache
          này, không gọi API từng SKU.
        </p>
      </header>

      {isStale ? (
        <Alert variant="destructive">
          <AlertTitle>
            {state.lastFullSyncAt ? 'Cache danh mục đã cũ' : 'Chưa đồng bộ lần nào'}
          </AlertTitle>
          <AlertDescription>
            {ageMs === null
              ? 'Chưa có dữ liệu trong cache. Hãy chạy “Đồng bộ lại từ đầu” trước khi kiểm tra file.'
              : `Lần đồng bộ đầy đủ gần nhất cách đây ${formatAge(ageMs)}, vượt ngưỡng ${config.catalogMaxAgeHours} giờ. Kết quả kiểm tra SKU có thể sai lệch.`}
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Đồng bộ đầy đủ gần nhất" value={formatDateTime(state.lastFullSyncAt)} />
        <StatCard label="Sản phẩm" value={state.productCount.toLocaleString('vi-VN')} />
        <StatCard label="Biến thể" value={state.variantCount.toLocaleString('vi-VN')} />
        <StatCard
          label="SKU rỗng"
          value={state.blankSkuCount.toLocaleString('vi-VN')}
          hint="Biến thể không có SKU - không thể đối chiếu với file Excel"
        />
        <StatCard
          label="SKU trùng"
          value={state.duplicateSkuCount.toLocaleString('vi-VN')}
          hint="Một SKU khớp nhiều biến thể - luật B5 sẽ cảnh báo"
        />
        <StatCard label="Mốc đồng bộ tăng dần" value={formatDateTime(state.lastCursor)} />
      </section>

      <SyncRunner />

      <p className="text-xs text-muted-foreground">
        Đồng bộ tăng dần chỉ lấy sản phẩm thay đổi sau mốc phía trên nên rất nhanh, nhưng không phát
        hiện được sản phẩm đã bị xoá. Chạy &ldquo;Đồng bộ lại từ đầu&rdquo; định kỳ để dọn sạch.
      </p>
    </main>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  )
}

function formatDateTime(value: Date | null): string {
  if (!value) return 'Chưa có'
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(value)
}

function formatAge(ms: number): string {
  const hours = Math.floor(ms / 3_600_000)
  if (hours < 1) return `${Math.max(1, Math.floor(ms / 60_000))} phút`
  if (hours < 48) return `${hours} giờ`
  return `${Math.floor(hours / 24)} ngày`
}
