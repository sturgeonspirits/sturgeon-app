import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import EventSignupForm from '@/components/events/EventSignupForm'
import Link from 'next/link'

interface Props { params: Promise<{ periodId: string }> }

export default async function EventSignupPage({ params }: Props) {
  const { periodId } = await params

  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient()

  // Fetch period + event type
  const { data: period } = await service
    .from('leaderboard_periods')
    .select('id, label, starts_at, is_finalized, event_type_id, event_types(name, icon, slug, participant_type)')
    .eq('id', periodId)
    .maybeSingle()

  if (!period) redirect('/events')

  const et = (period as any).event_types
  const todayChicago = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  const periodDateChicago = new Date(period.starts_at).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

  // Block sign-up if past or finalized
  if (period.is_finalized || periodDateChicago < todayChicago) {
    redirect(`/leaderboards/${et?.slug ?? ''}`)
  }

  // Fetch all permanent teams for this event type
  const { data: permTeams } = await service
    .from('permanent_teams')
    .select('id, name')
    .eq('event_type_id', period.event_type_id)
    .order('name')

  // Fetch any period-specific team rows that already exist (sign-ups so far)
  const { data: periodTeams } = await service
    .from('leaderboard_teams')
    .select('id, permanent_team_id, leaderboard_team_members(user_id, profiles(display_name, full_name))')
    .eq('period_id', periodId)

  // Build a map from permanent_team_id -> period team info
  const periodTeamMap = new Map<string, { periodTeamId: string; members: Array<{ userId: string; name: string }> }>()
  for (const pt of (periodTeams ?? [])) {
    const members = (pt.leaderboard_team_members ?? []).map((m: any) => ({
      userId: m.user_id,
      name: m.profiles?.display_name ?? m.profiles?.full_name ?? 'Member',
    }))
    periodTeamMap.set((pt as any).permanent_team_id, { periodTeamId: pt.id, members })
  }

  // Merge: show all permanent teams, overlaid with who signed up for this period
  const teams = (permTeams ?? []).map((pt: any) => {
    const periodInfo = periodTeamMap.get(pt.id)
    const members    = periodInfo?.members ?? []
    const isMine     = members.some(m => m.userId === user.id)
    return {
      periodTeamId:    periodInfo?.periodTeamId ?? null,
      permanentTeamId: pt.id,
      name:            pt.name,
      memberCount:     members.length,
      members:         members.map(m => m.name),
      isMine,
    }
  })

  const myTeam = teams.find(t => t.isMine) ?? null

  // Format display date
  const eventDate = new Date(period.starts_at).toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-[#F5F2EC]">
      <div className="max-w-lg mx-auto px-4 py-8 pb-28">
        {/* Back link */}
        <Link
          href="/events"
          className="inline-flex items-center gap-1.5 text-sm text-[#7E613F] hover:text-[#96321F] transition-colors mb-6"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to Events
        </Link>

        <EventSignupForm
          periodId={periodId}
          eventName={et?.name ?? 'Event'}
          eventIcon={et?.icon ?? '🎮'}
          eventDate={eventDate}
          teams={teams}
          myTeam={myTeam}
          participantType={et?.participant_type ?? 'team'}
        />
      </div>
    </div>
  )
}
