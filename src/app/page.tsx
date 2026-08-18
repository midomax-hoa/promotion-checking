import Link from 'next/link'
import { CatalogFreshnessAlert } from '@/components/check/catalog-freshness-alert'
import { UploadPanel } from '@/components/check/upload-panel'

/**
 * Screen 1 - upload and check.
 *
 * The catalog warning comes first on purpose: a check run against a stale cache
 * produces confident, wrong answers about which SKUs exist, and the moment to
 * say so is before the file goes in, not after.
 */

export const dynamic = 'force-dynamic'

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Kiểm tra file khuyến mãi</h1>
        <p className="text-sm text-muted-foreground">
          Tải file Excel lên để biết nó import vào Haravan được chưa, sai chỗ nào và sửa thế nào —
          trước khi import.
        </p>
      </header>

      <CatalogFreshnessAlert />
      <UploadPanel />

      <p className="text-sm text-muted-foreground">
        Xem lại các lần đã kiểm tra tại{' '}
        <Link href="/lich-su" className="underline">
          lịch sử kiểm tra
        </Link>
        .
      </p>
    </main>
  )
}
