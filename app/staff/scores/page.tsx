import { createClient } from '@/lib/supabase/server'
import ScoreEntryPanel from '@/components/staff/ScoreEntryPanel'

export default async function StaffScoresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // All active event types — staff sees all boards here
  const { data: eventTypes } = await supabase
    .from('event_types')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  // Active (open) periods per event type
  const { data: openPeriods } = await supabase
    .from('leaderboard_periods')
    .select('*')
    .eq('is_finalized', false)
    .order('starts_at', { ascending: false })

  // All members for participant lookup
  const { data: members } = await supabase
    .from('profiles')
    .select('id, display_name, email')
    .eq('role', 'customer')
    .order('display_name')

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
      />
    </div>
  )
}
