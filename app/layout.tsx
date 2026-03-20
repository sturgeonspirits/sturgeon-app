import type { Metadata, Viewport } from 'next'
import { Vollkorn, Inter } from 'next/font/google'
import './globals.css'

// Vollkorn: brand body/display font (closest Google Fonts match to brand's Vollkorn spec)
const vollkorn = Vollkorn({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Sturgeon Spirits',
  description: 'Spearers Club — loyalty, events & tastings',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Sturgeon' },
  other: { 'mobile-web-app-capable': 'yes' },
}

export const viewport: Viewport = {
  themeColor: '#0e0d0b',   // brand warm black
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${vollkorn.variable} ${inter.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={`${vollkorn.variable} ${inter.variable} font-sans bg-[#0e0d0b] text-[#F1F1E7] antialiased overscroll-none`}>
        {children}
      </body>
    </html>
  )
}
