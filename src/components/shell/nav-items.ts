/**
 * The five screens, in one list.
 *
 * Shared by the sidebar and anything else that needs to name a screen, so a
 * label or an icon is never written down twice.
 */

import { FileSearch, GitCompare, History, RefreshCw, SlidersHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /**
   * Paths that belong to this screen without sitting under its href. A result
   * page is the outcome of a check, so standing on /ket-qua/<id> has to keep
   * "Kiểm tra file" lit rather than lighting nothing at all.
   */
  ownedPrefixes: readonly string[]
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Kiểm tra file', icon: FileSearch, ownedPrefixes: ['/ket-qua'] },
  { href: '/lich-su', label: 'Lịch sử kiểm tra', icon: History, ownedPrefixes: [] },
  { href: '/doi-soat', label: 'Đối soát sau import', icon: GitCompare, ownedPrefixes: [] },
  { href: '/dong-bo', label: 'Đồng bộ danh mục', icon: RefreshCw, ownedPrefixes: [] },
  { href: '/cau-hinh', label: 'Cấu hình luật', icon: SlidersHorizontal, ownedPrefixes: [] },
]

function coversPath(base: string, pathname: string): boolean {
  return pathname === base || pathname.startsWith(base + '/')
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  // "/" is matched exactly - as a prefix it would own every path there is.
  const ownHref = item.href === '/' ? pathname === '/' : coversPath(item.href, pathname)
  return ownHref || item.ownedPrefixes.some((prefix) => coversPath(prefix, pathname))
}
