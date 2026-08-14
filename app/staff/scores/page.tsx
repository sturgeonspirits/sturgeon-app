// ─────────────────────────────────────────────
// Changelog
//   v2026-08-14.1 — Include is_roster in the member picker query so roster
//                   members are labelled in the score-entry pickers.
//   v2026-07-13.1 — Paginate the all-profiles fetch via fetchAllRows: PostgREST
//                   caps responses at 1,000 rows, so the member picker would
//                   silently omit members once profiles passed 1,000.
// ─────────────────────────────────────────────
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import ScoreEntryPanel from '@/components/staff/ScoreEntryPanel'
import SeasonManager from '@/components/staff/SeasonManager'

export default async function StaffScoresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Use service client so RLS doesn't filter out other users' profiles/periods
  const service = createServiceClient()

  // All active event types — staff sees all boards here
  const { data: eventTypes } = await service
    .from('event_types')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  // Active (open) periods per event type
  const { data: openPeriods } = await service
    .from('leaderboard_periods')
    .select('*')
    .eq('is_finalized', false)
    .order('starts_at', { ascending: false })

  // All profiles — no role filter so staff can enter scores even before customers sign up
  // (paginated; secondary order('id') keeps pages stable across duplicate/null names)
  const members = await fetchAllRows((from, to) => service
    .from('profiles')
    .select('id, display_name, full_name, phone, email, is_roster')
    .order('full_name')
    .order('id')
    .range(from, to))

  // Scheduled event dates — look back 30 days so staff can enter past scores;
  // look ahead 60 days so upcoming events don't appear as orphan "generic periods"
  const weekAgo     = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA')
  const twoWeeksOut = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA')
  const { data: scheduledEvents } = await service
    .from('events')
    .select('id, event_type_id, event_date, start_time, notes')
    .gte('event_date', weekAgo)
    .lte('event_date', twoWeeksOut)
    .eq('is_cancelled', false)
    .order('event_date')

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-xl font-bold text-[#F1F1E7]">Enter Scores</h1>
        <p className="text-sm text-[#7a6e5f]">Select an event to record results</p>
      </div>
      <ScoreEntryPanel
        eventTypes={eventTypes ?? []}
        openPeriods={openPeriods ?? []}
        members={members ?? []}
        staffId={user!.id}
        scheduledEvents={scheduledEvents ?? []}
      />

      <SeasonManager
        eventTypes={(eventTypes ?? []).map(et => ({ id: et.id, name: et.name, icon: et.icon ?? '' }))}
      />
    </div>
  )
}
