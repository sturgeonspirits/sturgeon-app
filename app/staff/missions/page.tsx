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

  const [{ data: missions }, { data: members }, { data: allMissions }] = await Promise.all([
    supabase.from('missions').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('profiles').select('id, display_name, full_name, phone, email').order('full_name'),
    serviceSupabase.from('missions').select('*').order('sort_order'),
  ])

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
        <StaffMissionPanel missions={missions ?? []} members={members ?? []} staffId={user!.id} />
      ) : (
        <MissionManagePanel missions={allMissions ?? []} />
      )}
    </div>
  )
}
