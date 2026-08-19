import { AppSettingForm } from '@/components/config/app-setting-form'
import { RuleConfigTable } from '@/components/config/rule-config-table'
import { RuleGroupJump } from '@/components/config/rule-group-jump'
import { PageShell } from '@/components/shell/page-shell'
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
    <PageShell
      title="Cấu hình luật kiểm tra"
      description="Mọi con số dùng khi kiểm tra file đều sửa được ngay tại đây. Ô nào đang khác giá trị ban đầu sẽ được tô nền nhạt và ghi rõ giá trị ban đầu, bấm Về mặc định là trả lại như cũ."
      width="medium"
    >
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Thiết lập chung</h2>
        <AppSettingForm values={values} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Luật kiểm tra theo nhóm</h2>
        <p className="text-sm text-muted-foreground">
          Bỏ chọn một luật thì lần kiểm tra sau không còn báo lỗi theo luật đó nữa. Đổi mức cảnh báo
          chỉ đổi màu và thứ tự ưu tiên trong bảng kết quả, còn lỗi thì vẫn phát hiện y như cũ.
        </p>
        <RuleGroupJump />
        <RuleConfigTable configs={configs} />
      </section>

      <p className="text-xs text-muted-foreground">
        Bấm lưu là áp dụng ngay cho lần kiểm tra kế tiếp. Các lần kiểm tra đã chạy trước đó vẫn giữ
        nguyên kết quả cũ, vì mỗi lần chạy đã lưu lại đúng những lỗi tìm thấy lúc đó.
      </p>
    </PageShell>
  )
}
