import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

// Geist has no `vietnamese` subset, so Vietnamese diacritics would fall back to a system font.
const sans = Inter({ variable: '--font-geist-sans', subsets: ['latin', 'vietnamese'] })
const mono = JetBrains_Mono({ variable: '--font-geist-mono', subsets: ['latin', 'vietnamese'] })

export const metadata: Metadata = {
  title: 'Kiểm tra file khuyến mãi',
  description: 'Công cụ kiểm tra và đối soát file import khuyến mãi Haravan',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className={`${sans.variable} ${mono.variable} antialiased`}>{children}</body>
    </html>
  )
}
