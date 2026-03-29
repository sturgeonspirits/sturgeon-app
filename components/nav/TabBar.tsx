'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'

const TABS = [
  {
    href: '/club',
    label: 'Club',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: '/menu',
    label: 'Menu',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <line x1="9" y1="12" x2="15" y2="12"/>
        <line x1="9" y1="16" x2="13" y2="16"/>
      </svg>
    ),
  },
  {
    href: '/journal',
    label: 'Journal',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
  },
  {
    href: '/leaderboards',
    label: 'Standings',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
] as const

export default function TabBar() {
  const pathname = usePathname()
  // Optimistic pending href — highlights the tapped tab instantly
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Clear pending once the route has actually changed
  const effectivePathname = pathname

  return (
    <nav
      className="shrink-0 bg-[#242622] border-t border-[#3a3c38] z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch h-16">
        {TABS.map(tab => {
          const isCurrentRoute = effectivePathname === tab.href ||
            (tab.href !== '/club' && effectivePathname.startsWith(tab.href))
          const isPending = pendingHref === tab.href
          const active = isCurrentRoute || isPending

          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={() => {
                if (!isCurrentRoute) {
                  // Highlight immediately — before navigation resolves
                  setPendingHref(tab.href)
                  startTransition(() => {
                    setPendingHref(null)
                  })
                }
              }}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 transition-colors relative',
                active ? 'text-[#96321F]' : 'text-[#FFFFFF]/60 hover:text-[#FFFFFF]'
              )}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-[#96321F] rounded-full" />
              )}
              {tab.icon(active)}
              <span className={cn(
                'text-[9px] font-medium uppercase tracking-widest leading-none',
                active ? 'text-[#96321F]' : 'text-[#FFFFFF]/60'
              )}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
