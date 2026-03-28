import type { Metadata, Viewport } from 'next'
import { Vollkorn, Inter, Barlow_Condensed } from 'next/font/google'
import './globals.css'

// Barlow Condensed: closest Google Fonts match to Prohibition / Trade Gothic Condensed
const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['600', '700', '800'],
})

// Vollkorn: brand body/paragraph font per brand guide
const vollkorn = Vollkorn({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

// Inter: clean UI font for labels, numbers, small text
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Sturgeon Spirits',
  description: 'Spearers Club — loyalty, events & tastings',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Sturgeon',
  },
  other: { 'mobile-web-app-capable': 'yes' },
}

export const viewport: Viewport = {
  themeColor: '#F1F1E7',   // cream — matches app background
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${barlowCondensed.variable} ${vollkorn.variable} ${inter.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="font-sans bg-[#F1F1E7] text-[#242622] antialiased overscroll-none">
        {children}
      </body>
    </html>
  )
}
