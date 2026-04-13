import { getAuthUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

// Format a YYYY-MM-DD date string as "Wed, Apr 16"
function fmtEventDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

export default async function LeaderboardsPage() {
  const { supabase, user } = await getAuthUser()
  if (!user) redirect('/auth/login')

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

  const [{ data: eventTypes }, { data: upcoming }, { data: recent }] = await Promise.all([
    supabase.from('event_types').select('id, name, slug, icon, schedule_label, description, participant_type, day_of_week, typical_time').eq('is_active', true).order('sort_order'),
    // Next scheduled event per type — limit to 10 (2 types × 5 weeks ahead is plenty)
    supabase.from('events')
      .select('event_type_id, event_date')
      .gte('event_date', today)
      .eq('is_cancelled', false)
      .order('event_date', { ascending: true })
      .limit(10),
    // Most recent past event per type — limit to 10
    supabase.from('events')
      .select('event_type_id, event_date')
      .lt('event_date', today)
      .eq('is_cancelled', false)
      .order('event_date', { ascending: false })
      .limit(10),
  ])

  // Build next/last maps: event_type_id → first match
  const nextMap = new Map<string, { date: string; time: string | null }>()
  for (const ev of (upcoming ?? [])) {
    if (!nextMap.has((ev as any).event_type_id))
      nextMap.set((ev as any).event_type_id, { date: (ev as any).event_date, time: (ev as any).start_time ?? null })
  }
  const lastMap = new Map<string, { date: string; time: string | null }>()
  for (const ev of (recent ?? [])) {
    if (!lastMap.has((ev as any).event_type_id))
      lastMap.set((ev as any).event_type_id, { date: (ev as any).event_date, time: (ev as any).start_time ?? null })
  }

  const events = eventTypes ?? []

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <div className="pt-4">
        <h1 className="font-display text-xl font-bold text-[#242622]">Standings</h1>
        <p className="text-sm text-[#7E613F] mt-1">Weekly leaderboards & all-time records</p>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 bg-[#FFFFFF] rounded-2xl border border-[#D4CFC3]">
          <p className="text-5xl mb-4">🥃</p>
          <p className="font-semibold text-[#242622] mb-1">Leaderboards coming soon</p>
          <p className="text-sm text-[#7E613F] px-6">
            Staff will set up event boards for Cribbage Night, Trivia, and more. Check back after your first event!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(et => (
            <Link
              key={et.id}
              href={`/leaderboards/${et.slug}`}
              className="block bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 hover:border-[#C8BCA4] transition-colors active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                  style={{ backgroundColor: '#96321F15', border: '1px solid #96321F30' }}
                >
                  {et.icon}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#242622]">{et.name}</p>
                  <p className="text-xs text-[#7E613F] mt-0.5">
                    {(() => {
                      const next = nextMap.get(et.id)
                      const last = lastMap.get(et.id)
                      if (next) return `Next: ${fmtEventDate(next.date)}`
                      if (last) return `Last: ${fmtEventDate(last.date)}`
                      return et.schedule_label ?? ''
                    })()}
                    {et.participant_type === 'team' ? ' · teams' : et.participant_type === 'individual' ? ' · individual' : ''}
                  </p>
                  {et.description && (
                    <p className="text-xs text-[#9E8F7E] mt-0.5">{et.description}</p>
                  )}
                </div>
                <span className="text-[#9E8F7E] text-lg">›</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-[#9E8F7E] text-center pt-2">
        You don't have to play to watch — all standings are public
      </p>
    </div>
  )
}
