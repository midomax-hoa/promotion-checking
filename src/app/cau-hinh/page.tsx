import { AppSettingForm } from '@/components/config/app-setting-form'
import { RuleConfigTable } from '@/components/config/rule-config-table'
import { prisma } from '@/lib/db/prisma'
import { loadRuleConfigs } from '@/lib/rules/rule-config-store'

/**
 * Screen 6 - configuration.
 *
 * Server Component: it reads the stored rows, merges them with the catalog
 * defaults through the same `loadRuleConfigs` the engine uses, and hands plain
 * values to the forms. What the screen shows is therefore exactly what the next
 * check run will use - not a second reading of the same table.
 */

export const dynamic = 'force-dynamic'

export default async function ConfigPage() {
  const [configs, settingRows] = await Promise.all([
    loadRuleConfigs(),
    prisma.appSetting.findMany(),
  ])
  const values = Object.fromEntries(settingRows.map((row) => [row.key, row.value]))

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Cấu hình luật kiểm tra</h1>
        <p className="text-sm text-muted-foreground">
          Mọi ngưỡng đều sửa được ở đây, không có con số nào bị chôn cứng trong mã nguồn. Giá trị
          khác mặc định được tô nền nhạt kèm ghi chú giá trị gốc.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Thiết lập chung</h2>
        <AppSettingForm values={values} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Luật kiểm tra theo nhóm</h2>
        <p className="text-sm text-muted-foreground">
          Tắt một luật thì luật đó không còn xuất hiện trong kết quả kiểm tra. Đổi mức cảnh báo chỉ
          đổi cách xếp loại, không đổi cách phát hiện.
        </p>
        <RuleConfigTable configs={configs} />
      </section>

      <p className="text-xs text-muted-foreground">
        Cấu hình áp dụng ngay cho lần kiểm tra kế tiếp. Kết quả đã lưu trước đó giữ nguyên, vì mỗi
        lần chạy ghi lại số phát hiện tại thời điểm đó.
      </p>
    </main>
  )
}
