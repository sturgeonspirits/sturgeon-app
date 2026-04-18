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

// Parse a period label like "Wednesday, April 9, 2026" → "Apr 9"
function shortDateFromLabel(label: string): string | null {
  const d = new Date(label)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface LatestWinner {
  eventTypeId: string
  periodLabel: string
  winnerName:  string
  detail:      string        // e.g. "3W–0L" or "1st place"
  isTeam:      boolean
}

export default async function LeaderboardsPage() {
  const { supabase, user } = await getAuthUser()
  if (!user) redirect('/auth/login')

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

  const [{ data: eventTypes }, { data: upcoming }, { data: recent }] = await Promise.all([
    supabase.from('event_types').select('id, name, slug, icon, schedule_label, description, participant_type, scoring_method, day_of_week, typical_time').eq('is_active', true).order('sort_order'),
    supabase.from('events')
      .select('event_type_id, event_date')
      .gte('event_date', today)
      .eq('is_cancelled', false)
      .order('event_date', { ascending: true })
      .limit(10),
    supabase.from('events')
      .select('event_type_id, event_date')
      .lt('event_date', today)
      .eq('is_cancelled', false)
      .order('event_date', { ascending: false })
      .limit(10),
  ])

  // Build next/last maps
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

  // ── Fetch latest winners for each event type ──────────────────────────────
  // Uses the user's authenticated client — all leaderboard tables have
  // public-read RLS policies so this works without the service-role key.
  //
  // Strategy: use the events table (event_date) to find the most recent events
  // per type, then look up the linked leaderboard_period via event_id. This is
  // more reliable than sorting periods by starts_at, which can be wrong if a
  // period was created via the old manual route.
  const winnerMap = new Map<string, LatestWinner>()

  if (events.length > 0) {
    // For each event type, walk backwards through recent events until we find
    // one with a leaderboard period that has actual scores.
    for (const et of events) {
      // Get the 5 most recent past events for this event type
      const { data: recentEvents } = await supabase
        .from('events')
        .select('id, event_date')
        .eq('event_type_id', et.id)
        .eq('is_cancelled', false)
        .lte('event_date', today)
        .order('event_date', { ascending: false })
        .limit(5)

      if (!recentEvents || recentEvents.length === 0) continue

      let periodInfo: { id: string; label: string } | null = null

      for (const ev of recentEvents) {
        // Find the period linked to this event
        const { data: period } = await supabase
          .from('leaderboard_periods')
          .select('id, label')
          .eq('event_id', ev.id)
          .limit(1)
          .maybeSingle()

        if (!period) continue

        // Check if this period has any actual scores
        if (et.participant_type === 'team') {
          const { data: hasTeams } = await supabase
            .from('leaderboard_teams')
            .select('id')
            .eq('period_id', period.id)
            .or('score.gt.0,placement.gt.0')
            .limit(1)
          if (hasTeams && hasTeams.length > 0) {
            periodInfo = { id: period.id, label: period.label }
            break
          }
        } else {
          const { data: hasScores } = await supabase
            .from('leaderboard_events')
            .select('id, wins, score')
            .eq('period_id', period.id)
            .or('wins.gt.0,score.gt.0')
            .limit(1)
          if (hasScores && hasScores.length > 0) {
            periodInfo = { id: period.id, label: period.label }
            break
          }
        }
      }

      if (!periodInfo) continue

      if (et.participant_type === 'team') {
        // Team event: winner is team with best placement (lowest number)
        const { data: winningTeam } = await supabase
          .from('leaderboard_teams')
          .select('name, score, placement')
          .eq('period_id', periodInfo.id)
          .gt('placement', 0)
          .order('placement', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (winningTeam) {
          winnerMap.set(et.id, {
            eventTypeId: et.id,
            periodLabel: periodInfo.label,
            winnerName:  winningTeam.name,
            detail:      winningTeam.score ? `${winningTeam.score} pts` : '1st place',
            isTeam:      true,
          })
        }
      } else {
        // Individual event: winner is the top scorer/most wins
        const { data: topEntry } = await supabase
          .from('leaderboard_events')
          .select('user_id, score, wins, losses')
          .eq('period_id', periodInfo.id)
          .or('wins.gt.0,score.gt.0')
          .order(et.scoring_method === 'wins_losses' ? 'wins' : 'score', { ascending: false })
          .order('score', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (topEntry && ((topEntry.wins ?? 0) > 0 || (topEntry.score ?? 0) > 0)) {
          // Fetch the winner's profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, full_name')
            .eq('id', topEntry.user_id)
            .maybeSingle()

          const name = profile?.display_name ?? profile?.full_name ?? 'Unknown'
          const detail = et.scoring_method === 'wins_losses'
            ? `${topEntry.wins}W–${topEntry.losses}L`
            : `${topEntry.score} pts`

          winnerMap.set(et.id, {
            eventTypeId: et.id,
            periodLabel: periodInfo.label,
            winnerName:  name,
            detail,
            isTeam:      false,
          })
        }
      }
    }
  }

  const hasWinners = winnerMap.size > 0

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <div className="pt-4">
        <h1 className="font-display text-xl font-bold text-[#242622]">Standings</h1>
        <p className="text-sm text-[#7E613F] mt-1">Weekly leaderboards & all-time records</p>
      </div>

      {/* Latest winners */}
      {hasWinners && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-[#7E613F] uppercase tracking-widest">Latest Winners</p>
          <div className="grid gap-2" style={{ gridTemplateColumns: winnerMap.size > 1 ? '1fr 1fr' : '1fr' }}>
            {events.map(et => {
              const winner = winnerMap.get(et.id)
              if (!winner) return null
              const dateLabel = shortDateFromLabel(winner.periodLabel)
              return (
                <Link
                  key={et.id}
                  href={`/leaderboards/${et.slug}`}
                  className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 hover:border-[#C8BCA4] transition-colors active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{et.icon}</span>
                    <span className="text-xs text-[#7E613F] font-medium">{et.name}</span>
                  </div>
                  <p className="text-lg">🏆</p>
                  <p className="font-bold text-[#242622] mt-1 truncate">
                    {winner.winnerName}
                  </p>
                  <p className="text-xs text-[#87A67F] font-semibold">{winner.detail}</p>
                  {dateLabel && (
                    <p className="text-xs text-[#9E8F7E] mt-1">{dateLabel}</p>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}

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
