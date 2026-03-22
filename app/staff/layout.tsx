// Staff console — separate layout, no consumer tab bar
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#EDE9DC]">
      {/* Staff nav bar */}
      <header className="bg-[#FFFFFF] border-b border-[#D4CFC3] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-full.png" alt="Sturgeon Spirits" className="h-8 w-auto" />
          <p className="text-xs text-[#96321F] font-semibold tracking-wide">Staff Console</p>
        </div>
        <nav className="flex gap-1">
          {[
            { href: '/staff',            label: 'Dashboard' },
            { href: '/staff/scores',     label: 'Scores'    },
            { href: '/staff/missions',   label: 'Missions'  },
            { href: '/staff/menu',       label: 'Menu'      },
            { href: '/staff/events',     label: 'Events'    },
            { href: '/staff/customers',  label: 'Customers' },
          ].map(link => (
            <a
              key={link.href}
              href={link.href}
              className="text-xs text-[#7E613F] hover:text-[#242622] px-3 py-1.5 rounded-lg hover:bg-[#F1F1E7] transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </header>
      <main className="p-4 max-w-2xl mx-auto">{children}</main>
    </div>
  )
}
