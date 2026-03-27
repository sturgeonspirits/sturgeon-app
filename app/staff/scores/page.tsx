import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import ScoreEntryPanel from '@/components/staff/ScoreEntryPanel'

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
  const { data: members } = await service
    .from('profiles')
    .select('id, display_name, full_name, phone, email')
    .order('full_name')

  // Scheduled event dates — look back 30 days so staff can enter scores for past events
  const weekAgo     = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA')
  const twoWeeksOut = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA')
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
    </div>
  )
}
