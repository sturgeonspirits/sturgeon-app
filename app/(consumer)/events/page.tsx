import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: eventTypes } = await supabase
    .from('event_types')
    .select('id, name, icon, day_of_week, typical_time, description')
    .eq('is_active', true)
    .order('sort_order')

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="max-w-lg mx-auto px-4 pb-10">
      <div className="pt-10 mb-6">
        <h1 className="font-display text-2xl font-bold text-[#242622] uppercase tracking-wide">
          Events
        </h1>
        <p className="text-sm text-[#7E613F] mt-1">Weekly happenings at Sturgeon Spirits</p>
      </div>

      {/* Recurring events */}
      {(eventTypes ?? []).length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-xs font-bold text-[#96321F] uppercase tracking-[0.18em]">Weekly Events</p>
            <div className="flex-1 h-px bg-[#D4CFC3]" />
          </div>
          <div className="space-y-2">
            {(eventTypes ?? []).map(et => (
              <Link
                key={et.id}
                href={`/leaderboards/${(et as any).slug ?? '#'}`}
                className="flex items-center gap-4 bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 hover:border-[#C8BCA4] transition-colors active:scale-[0.99]"
              >
                <div className="w-12 h-12 rounded-xl bg-[#96321F]/10 border border-[#96321F]/20 flex items-center justify-center text-2xl shrink-0">
                  {et.icon}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#242622]">{et.name}</p>
                  <p className="text-xs text-[#7E613F] mt-0.5">
                    {et.day_of_week != null ? `Every ${DAYS[et.day_of_week]}` : ''}
                    {et.typical_time ? ` · ${et.typical_time}` : ''}
                  </p>
                  {et.description && (
                    <p className="text-xs text-[#9E8F7E] mt-1">{et.description}</p>
                  )}
                </div>
                <span className="text-[#C8BCA4] text-lg">›</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Coming soon features */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <p className="text-xs font-bold text-[#96321F] uppercase tracking-[0.18em]">Coming Soon</p>
          <div className="flex-1 h-px bg-[#D4CFC3]" />
        </div>
        <div className="space-y-2">
          {[
            { icon: '📅', label: 'Event Calendar', desc: 'Browse upcoming special events and reservations' },
            { icon: '🎟️', label: 'RSVP & Tickets', desc: 'Reserve your spot at ticketed events' },
            { icon: '📍', label: 'QR Check-In', desc: 'Earn points when you check in at events' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-4 bg-[#FFFFFF] border border-[#D4CFC3]/60 rounded-2xl p-4 opacity-60">
              <div className="w-12 h-12 rounded-xl bg-[#EDE9DC] flex items-center justify-center text-2xl shrink-0">
                {item.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-[#242622]">{item.label}</p>
                  <span className="text-[10px] font-bold text-[#9E8F7E] bg-[#EDE9DC] px-2 py-0.5 rounded-full uppercase tracking-wide">
                    Soon
                  </span>
                </div>
                <p className="text-xs text-[#9E8F7E] mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
