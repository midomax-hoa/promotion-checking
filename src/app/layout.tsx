import type { Metadata } from 'next'
import Link from 'next/link'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

// Geist has no `vietnamese` subset, so Vietnamese diacritics would fall back to a system font.
const sans = Inter({ variable: '--font-geist-sans', subsets: ['latin', 'vietnamese'] })
const mono = JetBrains_Mono({ variable: '--font-geist-mono', subsets: ['latin', 'vietnamese'] })

export const metadata: Metadata = {
  title: 'Kiểm tra file khuyến mãi',
  description: 'Công cụ kiểm tra và đối soát file import khuyến mãi Haravan',
}

/** Screens are added phase by phase; only the ones that exist are linked. */
const NAV_ITEMS = [
  { href: '/', label: 'Kiểm tra file' },
  { href: '/lich-su', label: 'Lịch sử kiểm tra' },
  { href: '/doi-soat', label: 'Đối soát sau import' },
  { href: '/dong-bo', label: 'Đồng bộ danh mục' },
  { href: '/cau-hinh', label: 'Cấu hình luật' },
]

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The font variables belong on <html>, not <body>: globals.css applies
    // `font-sans` to <html>, and a custom property set on the child is
    // invisible to the parent - the whole page fell back to Times New Roman.
    <html lang="vi" className={`${sans.variable} ${mono.variable}`}>
      <body className="antialiased">
        <nav className="border-b">
          <div className="mx-auto flex max-w-4xl gap-4 p-4 text-sm">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="hover:underline">
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
}
