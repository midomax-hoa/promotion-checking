import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { RULE_CATALOG } from '../src/lib/rules/rule-catalog'
import { DEFAULT_APP_SETTINGS } from '../src/lib/config/app-settings-catalog'

/**
 * Seeds RuleConfig and AppSetting with their defaults.
 *
 * By default an existing row keeps the enabled/severity/params values an operator
 * tuned from the UI - only the descriptive fields are refreshed.
 *
 * Run `npm run db:seed:reset` (or pass --reset) to push the catalog defaults back
 * over existing rows. That is the supported way to roll out a changed default, for example
 * raising rule B6 to `critical` once Haravan's behaviour is confirmed; without it
 * such a change would silently never reach a database that has already been seeded.
 */
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('Thiếu biến môi trường DATABASE_URL. Xem file .env.example.')
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
// A CLI flag rather than an env var, so the same command works on Windows and Linux.
const resetDefaults = process.argv.includes('--reset')

async function main() {
  await prisma.$transaction(async (tx) => {
    for (const def of RULE_CATALOG) {
      const defaults = {
        enabled: def.defaultEnabled,
        severity: def.defaultSeverity,
        params: def.defaultParams ?? undefined,
      }
      await tx.ruleConfig.upsert({
        where: { code: def.code },
        update: {
          groupCode: def.groupCode,
          title: def.title,
          ...(resetDefaults ? defaults : {}),
        },
        create: { code: def.code, groupCode: def.groupCode, title: def.title, ...defaults },
      })
    }

    for (const setting of DEFAULT_APP_SETTINGS) {
      await tx.appSetting.upsert({
        where: { key: setting.key },
        update: resetDefaults ? { value: setting.value } : {},
        create: { key: setting.key, value: setting.value },
      })
    }

    await tx.syncState.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } })
  })

  const [rules, settings] = await Promise.all([
    prisma.ruleConfig.count(),
    prisma.appSetting.count(),
  ])
  const mode = resetDefaults ? ' (đã đẩy lại giá trị mặc định)' : ''
  console.log(`Seed done: ${rules} rules, ${settings} settings${mode}.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
