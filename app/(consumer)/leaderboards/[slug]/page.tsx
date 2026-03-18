import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import LeaderboardBoard from '@/components/leaderboard/LeaderboardBoard'

interface Props { params: Promise<{ slug: string }> }

export default async function LeaderboardDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase  = await createClient()

  // Fetch event type config — this drives ALL board behaviour
  const { data: eventType } = await supabase
    .from('event_types')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!eventType) notFound()

  // Fetch the most recent period for this event
  const { data: periods } = await supabase
    .from('leaderboard_periods')
    .select('*')
    .eq('event_type_id', eventType.id)
    .order('starts_at', { ascending: false })
    .limit(10)

  const currentPeriod = (periods ?? [])[0] ?? null

  // Fetch scores for current period
  let entries: any[] = []
  let teams:   any[] = []

  if (currentPeriod) {
    if (eventType.participant_type === 'team') {
      const { data: teamData } = await supabase
        .from('leaderboard_teams')
        .select('*, leaderboard_team_members(user_id, profiles(display_name, avatar_url))')
        .eq('period_id', currentPeriod.id)
        .order('placement')
      teams = teamData ?? []
    } else {
      const { data: entryData } = await supabase
        .from('leaderboard_events')
        .select('*, profiles(display_name, avatar_url, tier)')
        .eq('period_id', currentPeriod.id)
        .order(
          eventType.scoring_method === 'wins_losses' ? 'wins' : 'score',
          { ascending: false }
        )
      entries = entryData ?? []
    }
  }

  // All-time cache
  const { data: allTime } = await supabase
    .from('leaderboard_cache')
    .select('*, profiles(display_name, avatar_url)')
    .eq('event_type_id', eventType.id)
    .order('total_wins', { ascending: false })
    .limit(20)

  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="pt-4 flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${eventType.color}20`, border: `1px solid ${eventType.color}40` }}
        >
          {eventType.icon}
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{eventType.name}</h1>
          <p className="text-sm text-gray-500">{eventType.description}</p>
        </div>
      </div>

      <LeaderboardBoard
        eventType={eventType}
        currentPeriod={currentPeriod}
        periods={periods ?? []}
        entries={entries}
        teams={teams}
        allTime={allTime ?? []}
        currentUserId={user?.id}
      />
    </div>
  )
}
