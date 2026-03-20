// Staff console — separate layout, no consumer tab bar
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0e0d0b]">
      {/* Staff nav bar */}
      <header className="bg-[#161410] border-b border-[#2c2820] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <span className="text-xl">🐟</span>
          <div>
            <p className="text-sm font-bold text-[#F1F1E7] leading-none">Sturgeon Spirits</p>
            <p className="text-xs text-[#96321F] leading-none mt-0.5 tracking-wide">Staff Console</p>
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
              className="text-xs text-[#7a6e5f] hover:text-[#F1F1E7] px-3 py-1.5 rounded-lg hover:bg-[#2c2820] transition-colors"
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
