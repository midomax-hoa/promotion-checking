'use client'

/**
 * The left rail, and the only client component in the frame.
 *
 * It is a sibling of `{children}` rather than a wrapper around it: wrapping
 * would drag every page into the client bundle, and the pages are Server
 * Components that read the database directly.
 *
 * Below `lg` it becomes a drawer. An operator's screen is often 1366px wide,
 * where 240px of permanent rail is affordable - at 1024px and under it is not.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, ShieldCheck, X } from 'lucide-react'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { cn } from '@/lib/utils'
import { isNavItemActive, NAV_ITEMS } from './nav-items'

export function AppSidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Navigating inside the drawer has to close it, or the destination arrives
  // hidden behind the panel that linked to it.
  useEffect(() => setOpen(false), [pathname])

  return (
    <>
      {/* In normal flow rather than floating, so it pushes the page down
          instead of landing on top of the heading. */}
      <div className="flex items-center gap-2 border-b px-3 py-2 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Mở danh sách màn hình"
          aria-expanded={open}
          className="flex size-8 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Menu aria-hidden className="size-5" />
        </button>
        <span className="flex-1 text-sm font-semibold">Kiểm tra khuyến mãi</span>
        <ThemeToggle />
      </div>

      {open ? (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
        />
      ) : null}

      <div
        className={cn(
          'z-50 flex w-60 shrink-0 flex-col gap-1 border-r bg-sidebar text-sidebar-foreground',
          'fixed inset-y-0 left-0 transition-transform duration-200',
          'lg:sticky lg:top-0 lg:h-svh lg:translate-x-0 lg:self-start',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-2 px-3 py-3">
          <ShieldCheck aria-hidden className="size-5 shrink-0 text-sidebar-primary" />
          <span className="flex-1 text-sm leading-tight font-semibold">Kiểm tra khuyến mãi</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Đóng danh sách màn hình"
            className="flex size-7 items-center justify-center rounded-md hover:bg-sidebar-accent lg:hidden"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <nav aria-label="Màn hình" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2">
          {NAV_ITEMS.map((item) => {
            const active = isNavItemActive(item, pathname)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                // The colour is backed up by aria-current so the active screen
                // is announced, not just tinted.
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring',
                  active
                    ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                )}
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                <span className="min-w-0 flex-1">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="hidden items-center gap-2 border-t px-3 py-3 lg:flex">
          <span className="flex-1 text-xs text-muted-foreground">Hiển thị</span>
          <ThemeToggle />
        </div>
      </div>
    </>
  )
}
