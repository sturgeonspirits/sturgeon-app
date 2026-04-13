import type { Metadata, Viewport } from 'next'
import './globals.css'
// Self-hosted via @fontsource — zero network fetch at build time.
// Font face rules are emitted into the CSS bundle; CSS variables are
// declared in globals.css so Tailwind's font-family utilities resolve them.
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow-condensed/700.css'
import '@fontsource/barlow-condensed/800.css'
import '@fontsource/vollkorn/400.css'
import '@fontsource/vollkorn/500.css'
import '@fontsource/vollkorn/600.css'
import '@fontsource/vollkorn/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'

export const metadata: Metadata = {
  title: 'Sturgeon Spirits',
  description: 'Spearers Club — loyalty, events & tastings',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Spearer',
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
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="font-sans bg-[#F1F1E7] text-[#242622] antialiased overscroll-none">
        {children}
      </body>
    </html>
  )
}
