'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV_LINKS = [
  { href: '/staff',             label: 'Dashboard'    },
  { href: '/staff/scores',      label: 'Scores'       },
  { href: '/staff/customers',   label: 'Customers'    },
  { href: '/staff/redemptions', label: 'Redemptions'  },
  { href: '/staff/rewards',     label: 'Rewards'      },
  { href: '/staff/missions',    label: 'Missions'     },
  { href: '/staff/events',      label: 'Events'       },
  { href: '/staff/menu',        label: 'Menu'         },
  { href: '/staff/toast-sync',  label: 'Toast Sync'   },
  { href: '/leaderboards',      label: 'Leaderboards' },
]

export default function StaffNavBar() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/staff/login')
  }

  return (
    <>
      <header className="bg-white border-b border-[#D4CFC3] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        {/* Logo */}
        <div className="flex items-center gap-2 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-full.png" alt="Sturgeon Spirits" className="h-7 w-auto flex-shrink-0" />
          <p className="text-xs text-[#96321F] font-semibold tracking-wide whitespace-nowrap">Staff Console</p>
        </div>

        {/* Desktop nav — hidden on mobile */}
        <nav className="hidden lg:flex items-center gap-0.5 mx-4">
          {NAV_LINKS.map(link => (
            <a key={link.href} href={link.href}
              className="text-xs text-[#7E613F] hover:text-[#242622] px-2 py-1.5 rounded-lg hover:bg-[#F1F1E7] transition-colors whitespace-nowrap">
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right side: customer view + logout (desktop), hamburger (mobile) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href="/club"
            className="hidden sm:flex items-center gap-1.5 text-xs bg-[#F1F1E7] text-[#7E613F] px-3 py-1.5 rounded-lg hover:bg-[#D4CFC3] transition-colors whitespace-nowrap">
            <span>👤</span> Customer view
          </Link>
          <button onClick={handleLogout}
            className="hidden sm:flex items-center gap-1.5 text-xs bg-[#F1F1E7] text-[#7E613F] px-3 py-1.5 rounded-lg hover:bg-[#D4CFC3] transition-colors whitespace-nowrap">
            Sign out
          </button>

          {/* Hamburger button — visible on mobile */}
          <button
            onClick={() => setOpen(o => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="lg:hidden flex flex-col justify-center items-center w-9 h-9 rounded-lg hover:bg-[#F1F1E7] transition-colors gap-1.5">
            <span className={`block w-5 h-0.5 bg-[#242622] origin-center transition-all duration-200 ${open ? 'rotate-45 translate-y-[7px]' : ''}`} />
            <span className={`block w-5 h-0.5 bg-[#242622] transition-all duration-200 ${open ? 'opacity-0 scale-x-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-[#242622] origin-center transition-all duration-200 ${open ? '-rotate-45 -translate-y-[7px]' : ''}`} />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden bg-white border-b border-[#D4CFC3] z-30 shadow-md">
          <nav className="px-4 py-3 grid grid-cols-2 gap-1">
            {NAV_LINKS.map(link => (
              <a key={link.href} href={link.href}
                onClick={() => setOpen(false)}
                className="text-sm text-[#242622] py-2.5 px-3 rounded-xl hover:bg-[#F1F1E7] transition-colors">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="border-t border-[#D4CFC3] px-4 py-3 flex gap-2">
            <Link href="/club"
              onClick={() => setOpen(false)}
              className="flex-1 text-center text-sm text-[#7E613F] bg-[#F1F1E7] py-2.5 px-3 rounded-xl hover:bg-[#D4CFC3] transition-colors">
              👤 Customer view
            </Link>
            <button onClick={handleLogout}
              className="flex-1 text-sm text-[#96321F] bg-[#F1F1E7] py-2.5 px-3 rounded-xl hover:bg-[#D4CFC3] transition-colors font-medium">
              Sign out
            </button>
          </div>
        </div>
      )}
    </>
  )
}
