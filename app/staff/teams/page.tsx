import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TeamManager, { type EventTypeGroup } from './TeamManager'

export const dynamic = 'force-dynamic'

export default async function TeamsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const service = createServiceClient()

  // Fetch all team-based event types
  const { data: eventTypes } = await service
    .from('event_types')
    .select('id, name, icon')
    .eq('is_active', true)
    .eq('participant_type', 'team')
    .order('sort_order')

  if (!eventTypes?.length) {
    return (
      <div className="max-w-xl mx-auto py-10 px-4">
        <h1 className="text-xl font-bold text-[#242622] mb-2">Team Management</h1>
        <p className="text-sm text-[#7E613F]">No team-based events found.</p>
      </div>
    )
  }

  // Fetch all permanent teams with period counts
  const { data: teams } = await service
    .from('permanent_teams')
    .select('id, name, event_type_id')
    .order('name')

  // Fetch period play counts per team
  const { data: periodCounts } = await service
    .from('leaderboard_teams')
    .select('permanent_team_id, leaderboard_periods(starts_at)')

  // Build count + last-played maps
  const countMap  = new Map<string, number>()
  const lastMap   = new Map<string, string>()

  for (const row of (periodCounts ?? [])) {
    const id = (row as any).permanent_team_id
    if (!id) continue
    countMap.set(id, (countMap.get(id) ?? 0) + 1)
    const starts = (row as any).leaderboard_periods?.starts_at
    if (starts) {
      const existing = lastMap.get(id)
      if (!existing || starts > existing) lastMap.set(id, starts)
    }
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      timeZone: 'America/Chicago',
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  // Group teams by event type
  const groups: EventTypeGroup[] = (eventTypes ?? []).map(et => ({
    id:   et.id,
    name: et.name,
    icon: et.icon ?? '🎮',
    teams: (teams ?? [])
      .filter(t => (t as any).event_type_id === et.id)
      .map(t => ({
        id:          t.id,
        name:        t.name,
        periodCount: countMap.get(t.id) ?? 0,
        lastPlayed:  lastMap.has(t.id) ? fmtDate(lastMap.get(t.id)!) : null,
      })),
  }))

  const totalTeams = (teams ?? []).length

  return (
    <div className="max-w-xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/staff"
          className="text-[#9E8F7E] hover:text-[#7E613F] transition-colors"
          aria-label="Back"
        >
          ←
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#242622]">Team Management</h1>
          <p className="text-sm text-[#7E613F]">
            {totalTeams} team{totalTeams !== 1 ? 's' : ''} across {eventTypes.length} event type{eventTypes.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <TeamManager groups={groups} />
    </div>
  )
}
