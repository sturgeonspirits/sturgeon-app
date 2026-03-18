// Staff console — separate layout, no consumer tab bar
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Staff nav bar */}
      <header className="bg-[#1a1a1a] border-b border-[#2e2e2e] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <span className="text-xl">🐟</span>
          <div>
            <p className="text-sm font-bold text-white leading-none">Sturgeon Spirits</p>
            <p className="text-xs text-[#f5c842] leading-none mt-0.5">Staff Console</p>
          </div>
        </div>
        <nav className="flex gap-1">
          {[
            { href: '/staff',          label: 'Dashboard' },
            { href: '/staff/scores',   label: 'Scores' },
            { href: '/staff/missions', label: 'Missions' },
          ].map(link => (
            <a
              key={link.href}
              href={link.href}
              className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-[#2e2e2e] transition-colors"
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
