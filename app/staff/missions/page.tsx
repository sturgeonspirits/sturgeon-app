import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import StaffMissionPanel from '@/components/staff/StaffMissionPanel'
import MissionManagePanel from './MissionManagePanel'

export default async function StaffMissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const activeTab = tab === 'manage' ? 'manage' : 'complete'

  const supabase        = await createClient()
  const serviceSupabase = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: missions }, { data: members }, { data: allMissions }, { data: rawRequests }] = await Promise.all([
    supabase.from('missions').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('profiles').select('id, display_name, full_name, phone, email').order('full_name'),
    serviceSupabase.from('missions').select('*').order('sort_order'),
    serviceSupabase
      .from('mission_completion_requests')
      .select('id, created_at, user_id, mission_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
  ])

  // Manual join: PostgREST embedded joins fail on freshly-created tables
  // before the FK schema cache is warm, so we fetch missions/profiles separately.
  const requestMissionIds = Array.from(new Set((rawRequests ?? []).map(r => r.mission_id)))
  const requestUserIds    = Array.from(new Set((rawRequests ?? []).map(r => r.user_id)))

  const [{ data: requestMissions }, { data: requestProfiles }] = await Promise.all([
    requestMissionIds.length
      ? serviceSupabase.from('missions').select('id, title, icon, points').in('id', requestMissionIds)
      : Promise.resolve({ data: [] as { id: string; title: string; icon: string; points: number }[] }),
    requestUserIds.length
      ? serviceSupabase.from('profiles').select('id, display_name, full_name, email').in('id', requestUserIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null; full_name: string | null; email: string | null }[] }),
  ])

  const missionById = new Map((requestMissions ?? []).map(m => [m.id, m]))
  const profileById = new Map((requestProfiles ?? []).map(p => [p.id, p]))

  const pendingRequests = (rawRequests ?? []).map(r => {
    const m = missionById.get(r.mission_id)
    const p = profileById.get(r.user_id)
    return {
      id:         r.id,
      created_at: r.created_at,
      user_id:    r.user_id,
      mission_id: r.mission_id,
      missions:   m ? { title: m.title, icon: m.icon, points: m.points } : null,
      profiles:   p ? { display_name: p.display_name, full_name: p.full_name, email: p.email } : null,
    }
  })

  return (
    <div className="space-y-5 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#242622]">Mission Control</h1>
          <p className="text-sm text-[#7E613F]">Mark completions or manage missions</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-[#E8E4D6] rounded-xl p-1 gap-1">
        <a href="/staff/missions"
          className={`flex-1 text-center text-sm font-medium py-2 rounded-lg transition-colors ${
            activeTab === 'complete'
              ? 'bg-white text-[#242622] shadow-sm'
              : 'text-[#7E613F] hover:text-[#242622]'
          }`}>
          ✓ Mark Completions
        </a>
        <a href="/staff/missions?tab=manage"
          className={`flex-1 text-center text-sm font-medium py-2 rounded-lg transition-colors ${
            activeTab === 'manage'
              ? 'bg-white text-[#242622] shadow-sm'
              : 'text-[#7E613F] hover:text-[#242622]'
          }`}>
          ✏️ Manage
        </a>
      </div>

      {activeTab === 'complete' ? (
        <StaffMissionPanel missions={missions ?? []} members={members ?? []} staffId={user!.id} pendingRequests={pendingRequests} />
      ) : (
        <MissionManagePanel missions={allMissions ?? []} />
      )}
    </div>
  )
}
