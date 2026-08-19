import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { hashPassword } from '../src/lib/auth/password'
import { checkEmail, checkPassword, checkUsername, normalizeUsername } from '../src/lib/auth/user-identity'
import { APP_SETTING_KEYS, defaultSettingValue } from '../src/lib/config/app-settings-catalog'
import { ask, askHidden, fail, flag } from './console-prompt'

/**
 * Account administration from the terminal.
 *
 * The tool has no user-management screen on purpose: accounts are handed out
 * rarely, and a screen for it would have meant building roles to decide who may
 * open it. Run these on the server that hosts the app.
 *
 *   npm run user:create -- --username hoa --email hoa@example.com
 *   npm run user:list
 *   npm run user:passwd -- --username hoa
 *   npm run user:delete -- --username hoa
 *
 * Imports are relative rather than `@/...` because tsx runs this file outside
 * Next.js, where the path alias does not exist.
 */

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  fail('Thiếu biến môi trường DATABASE_URL. Xem file .env.example.')
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const argv = process.argv.slice(2)
const command = argv[0] ?? ''

async function minPasswordLength(): Promise<number> {
  const key = APP_SETTING_KEYS.authMinPasswordLength
  const row = await prisma.appSetting.findUnique({ where: { key } })
  const value = Number(row?.value ?? defaultSettingValue(key))
  // A blank or broken row must not turn into a zero-length minimum.
  return Number.isInteger(value) && value > 0 ? value : 8
}

/** Asks twice, because a typo here locks somebody out of an account they just got. */
async function readNewPassword(): Promise<string> {
  const minLength = await minPasswordLength()
  const password = await askHidden(`Mật khẩu (ít nhất ${minLength} ký tự)`)
  const checked = checkPassword(password, minLength)
  if (!checked.ok) fail(checked.message)
  if ((await askHidden('Nhập lại mật khẩu')) !== password) fail('Hai lần nhập không giống nhau.')
  return password
}

async function requireExistingUser(): Promise<{ id: string; username: string }> {
  const raw = flag(argv, 'username') ?? (await ask('Tên đăng nhập'))
  const user = await prisma.user.findUnique({
    where: { username: normalizeUsername(raw) },
    select: { id: true, username: true },
  })
  if (!user) fail(`Không có tài khoản nào tên "${raw}".`)
  return user
}

async function createUser(): Promise<void> {
  const username = checkUsername(flag(argv, 'username') ?? (await ask('Tên đăng nhập')))
  if (!username.ok) fail(username.message)
  const email = checkEmail(flag(argv, 'email') ?? (await ask('Email')))
  if (!email.ok) fail(email.message)

  const taken = await prisma.user.findFirst({
    where: { OR: [{ username: username.value }, { email: email.value }] },
    select: { username: true, email: true },
  })
  if (taken) {
    fail(
      taken.username === username.value
        ? `Tên đăng nhập "${username.value}" đã có người dùng.`
        : `Email "${email.value}" đã gắn với tài khoản "${taken.username}".`,
    )
  }

  const password = await readNewPassword()
  await prisma.user.create({
    data: { username: username.value, email: email.value, passwordHash: await hashPassword(password) },
  })
  console.log(`Đã tạo tài khoản "${username.value}".`)
}

async function changePassword(): Promise<void> {
  const user = await requireExistingUser()
  const password = await readNewPassword()
  await prisma.user.update({
    where: { id: user.id },
    // Clearing the lock as well: an admin resetting a password is exactly what
    // should end a lockout, otherwise the new password is unusable for a while.
    data: { passwordHash: await hashPassword(password), failedAttempts: 0, lockedUntil: null },
  })
  // Every other browser has to sign in again - the old password may be the
  // reason the password is being changed at all.
  const { count } = await prisma.session.deleteMany({ where: { userId: user.id } })
  console.log(`Đã đổi mật khẩu cho "${user.username}". Đã đăng xuất ${count} phiên đang mở.`)
}

async function deleteUser(): Promise<void> {
  const user = await requireExistingUser()
  const confirmation = await ask(`Gõ đúng "${user.username}" để xác nhận xoá`)
  if (confirmation !== user.username) fail('Không khớp, chưa xoá gì hết.')
  // Sessions go with it: the relation is onDelete: Cascade.
  await prisma.user.delete({ where: { id: user.id } })
  console.log(`Đã xoá tài khoản "${user.username}".`)
}

async function listUsers(): Promise<void> {
  const users = await prisma.user.findMany({ orderBy: { username: 'asc' } })
  if (users.length === 0) {
    console.log('Chưa có tài khoản nào. Chạy: npm run user:create')
    return
  }
  const format = (value: Date | null) =>
    value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(value) : '—'
  console.table(
    users.map((user) => ({
      'Tên đăng nhập': user.username,
      Email: user.email,
      'Đăng nhập lần cuối': format(user.lastLoginAt),
      'Khoá tới': format(user.lockedUntil),
    })),
  )
}

const COMMANDS: Record<string, () => Promise<void>> = {
  create: createUser,
  list: listUsers,
  passwd: changePassword,
  delete: deleteUser,
}

async function main(): Promise<void> {
  const run = COMMANDS[command]
  if (!run) fail(`Lệnh không hợp lệ. Dùng một trong: ${Object.keys(COMMANDS).join(', ')}.`)
  await run()
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
