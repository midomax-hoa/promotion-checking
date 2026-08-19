import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { AppSidebar } from '@/components/shell/app-sidebar'
import { ThemeScript } from '@/components/theme/theme-script'
import { getCurrentUser } from '@/lib/auth/current-user'
import './globals.css'

// Geist has no `vietnamese` subset, so Vietnamese diacritics would fall back to a system font.
const sans = Inter({ variable: '--font-geist-sans', subsets: ['latin', 'vietnamese'] })
const mono = JetBrains_Mono({ variable: '--font-geist-mono', subsets: ['latin', 'vietnamese'] })

export const metadata: Metadata = {
  title: 'Kiểm tra file khuyến mãi',
  description: 'Công cụ kiểm tra và đối soát file import khuyến mãi Haravan',
}

/** Target of the skip link, and the landmark every screen renders into. */
const CONTENT_ID = 'noi-dung'

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Read here rather than inside the sidebar so the login screen, which has no
  // user, renders without the frame instead of with an empty one.
  const user = await getCurrentUser()

  return (
    // The font variables belong on <html>, not <body>: globals.css applies
    // `font-sans` to <html>, and a custom property set on the child is
    // invisible to the parent - the whole page fell back to Times New Roman.
    // suppressHydrationWarning: the head script sets the theme class on <html>
    // before React arrives, so the attribute it sees never matches the server's.
    <html lang="vi" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="antialiased">
        {/* First thing Tab reaches, so five sidebar links are not the toll for
            getting to the page a keyboard user actually came for. */}
        {user ? (
          <a
            href={`#${CONTENT_ID}`}
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-60 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
          >
            Nhảy tới nội dung
          </a>
        ) : null}
        <div className="flex min-h-svh flex-col lg:flex-row">
          {user ? <AppSidebar username={user.username} /> : null}
          {/* min-w-0 so a wide table scrolls inside its own box instead of
              stretching the grid and dragging the whole page sideways. */}
          <main id={CONTENT_ID} className="min-w-0 flex-1">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
