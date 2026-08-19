import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { RULE_CATALOG } from '../src/lib/rules/rule-catalog'
import {
  APP_SETTING_KEYS,
  DEFAULT_APP_SETTINGS,
  defaultSettingValue,
} from '../src/lib/config/app-settings-catalog'
import { hashPassword } from '../src/lib/auth/password'
import { checkEmail, checkPassword, checkUsername } from '../src/lib/auth/user-identity'

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

  await seedFirstAdmin()

  const [rules, settings] = await Promise.all([
    prisma.ruleConfig.count(),
    prisma.appSetting.count(),
  ])
  const mode = resetDefaults ? ' (đã đẩy lại giá trị mặc định)' : ''
  console.log(`Seed done: ${rules} rules, ${settings} settings${mode}.`)
}

/**
 * Creates the very first account from the environment, so a fresh Docker
 * deployment has something to log in with.
 *
 * Only when the table is empty. It is not a way to reset a password or to add a
 * second operator - `npm run user:create` and `npm run user:passwd` are - and
 * re-running the seed on a live database must never resurrect an account that
 * was deliberately deleted.
 */
async function seedFirstAdmin(): Promise<void> {
  if ((await prisma.user.count()) > 0) return

  const username = checkUsername(process.env.AUTH_SEED_USERNAME ?? '')
  const email = checkEmail(process.env.AUTH_SEED_EMAIL ?? '')
  const password = process.env.AUTH_SEED_PASSWORD ?? ''
  if (!username.ok || !email.ok || password === '') {
    console.log(
      'Chưa có tài khoản nào. Đặt AUTH_SEED_USERNAME, AUTH_SEED_EMAIL, AUTH_SEED_PASSWORD rồi chạy lại, '
      + 'hoặc chạy: npm run user:create',
    )
    return
  }

  const minLength = Number(
    (await prisma.appSetting.findUnique({ where: { key: APP_SETTING_KEYS.authMinPasswordLength } }))
      ?.value ?? defaultSettingValue(APP_SETTING_KEYS.authMinPasswordLength),
  )
  const checked = checkPassword(password, Number.isInteger(minLength) && minLength > 0 ? minLength : 8)
  if (!checked.ok) {
    console.log(`Không tạo được tài khoản đầu tiên: ${checked.message}`)
    return
  }

  await prisma.user.create({
    data: {
      username: username.value,
      email: email.value,
      passwordHash: await hashPassword(password),
    },
  })
  console.log(`Đã tạo tài khoản đầu tiên: ${username.value}. Đổi mật khẩu sau lần đăng nhập đầu.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
