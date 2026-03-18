'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/club',         label: 'Club',        icon: '🎯' },
  { href: '/leaderboards', label: 'Leaderboards', icon: '🏆' },
  { href: '/journal',      label: 'Journal',      icon: '🥃' },
  { href: '/rewards',      label: 'Rewards',      icon: '🎁' },
  { href: '/profile',      label: 'Profile',      icon: '👤' },
  // Future tabs slot in here: Discover (Shanty + Map), Shop (LiquidRails), etc.
] as const

export default function TabBar() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-[#0f0f0f]/95 backdrop-blur-md border-t border-[#2e2e2e] z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch h-[60px]">
        {TABS.map(tab => {
          const active = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
                active ? 'text-[#f5c842]' : 'text-gray-600 hover:text-gray-400'
              )}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span className={cn('text-[10px] font-medium leading-none', active ? 'text-[#f5c842]' : 'text-gray-600')}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
