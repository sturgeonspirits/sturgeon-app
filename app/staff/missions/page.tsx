import { createClient } from '@/lib/supabase/server'
import StaffMissionPanel from '@/components/staff/StaffMissionPanel'

export default async function StaffMissionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: missions }, { data: members }] = await Promise.all([
    supabase.from('missions').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('profiles').select('id, display_name, email').order('display_name'),
  ])

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-xl font-bold text-[#242622]">Mission Control</h1>
        <p className="text-sm text-[#7E613F]">Manually complete missions or generate QR codes</p>
      </div>
      <StaffMissionPanel missions={missions ?? []} members={members ?? []} staffId={user!.id} />
    </div>
  )
}
