import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RedemptionActions from './RedemptionActions'

export default async function RedemptionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff/login')

  const { data: redemptions } = await supabase
    .from('reward_redemptions')
    .select('*, profiles(display_name, email), rewards(name, icon, reward_value, redemption_method)')
    .order('created_at', { ascending: false })
    .limit(100)

  const pending  = (redemptions ?? []).filter(r => r.status === 'pending')
  const resolved = (redemptions ?? []).filter(r => r.status !== 'pending')

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-xl font-bold text-[#242622]">Redemptions</h1>
        <p className="text-sm text-[#7E613F]">
          {pending.length > 0
            ? `${pending.length} pending approval`
            : 'All caught up — no pending requests'}
        </p>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-3">
            Pending ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map(r => (
              <RedemptionRow key={r.id} r={r} staffId={user.id} showActions />
            ))}
          </div>
        </section>
      )}

      {/* History */}
      {resolved.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-3">
            History
          </h2>
          <div className="space-y-2">
            {resolved.map(r => (
              <RedemptionRow key={r.id} r={r} staffId={user.id} showActions={false} />
            ))}
          </div>
        </section>
      )}

      {(redemptions ?? []).length === 0 && (
        <div className="text-center py-16 text-[#7E613F]">
          <p className="text-4xl mb-3">🎟️</p>
          <p className="font-semibold">No redemptions yet</p>
          <p className="text-sm mt-1">They'll appear here when members request rewards.</p>
        </div>
      )}
    </div>
  )
}

function statusBadge(status: string) {
  switch (status) {
    case 'pending':  return <span className="text-xs font-semibold bg-amber-100  text-amber-800  px-2 py-0.5 rounded-full">Pending</span>
    case 'approved': return <span className="text-xs font-semibold bg-green-100  text-green-800  px-2 py-0.5 rounded-full">Approved</span>
    case 'rejected': return <span className="text-xs font-semibold bg-red-100    text-red-800    px-2 py-0.5 rounded-full">Rejected</span>
    default:         return <span className="text-xs font-semibold bg-gray-100   text-gray-700   px-2 py-0.5 rounded-full">{status}</span>
  }
}

function RedemptionRow({
  r,
  staffId,
  showActions,
}: {
  r: any
  staffId: string
  showActions: boolean
}) {
  const reward   = r.rewards   as any
  const profile  = r.profiles  as any
  const date     = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="bg-white border border-[#D4CFC3] rounded-xl p-3 flex items-center gap-3">
      <span className="text-2xl flex-shrink-0">{reward?.icon ?? '🎁'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#242622] truncate">{reward?.name}</p>
        <p className="text-xs text-[#7E613F] truncate">
          {profile?.display_name ?? profile?.email ?? 'Unknown'} · {date}
        </p>
        {reward?.reward_value && (
          <p className="text-xs text-[#96321F] mt-0.5">{reward.reward_value}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        {statusBadge(r.status)}
        {showActions && <RedemptionActions redemptionId={r.id} staffId={staffId} />}
      </div>
    </div>
  )
}
