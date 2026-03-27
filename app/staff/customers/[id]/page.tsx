import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import RedeemPanel from './RedeemPanel'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const service = createServiceClient()

  // Fetch customer profile
  const { data: profile } = await service
    .from('profiles')
    .select('id, display_name, full_name, email, phone, tier, created_at, pos_customer_id, birthday')
    .eq('id', id)
    .single()

  if (!profile) notFound()

  const [
    { data: ledger },
    { data: toastAccount },
    { data: redemptions },
    { data: rewards },
    { data: recentEarns },
  ] = await Promise.all([
    service.from('points_ledger').select('balance').eq('user_id', id).single(),
    service.from('toast_loyalty_accounts').select('toast_points, card_number, last_trans_at').eq('profile_id', id).maybeSingle(),
    service
      .from('reward_redemptions')
      .select('id, status, redeemed_at, notes, created_at, rewards(name, icon, points_cost), profiles!redeemed_by(display_name)')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    service
      .from('rewards')
      .select('id, name, icon, description, points_cost, reward_value, redemption_method')
      .eq('is_active', true)
      .order('sort_order'),
    service
      .from('earn_events')
      .select('id, event_type, points_delta, notes, created_at, context_type')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  const balance = ledger?.balance ?? 0

  return (
    <div className="space-y-6 py-4">
      {/* Back */}
      <Link href="/staff/customers" className="text-xs text-[#7E613F] hover:text-[#96321F] transition-colors">
        ← Customers
      </Link>

      {/* Profile card */}
      <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-5 space-y-3">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-[#96321F]/10 flex items-center justify-center shrink-0">
            <span className="text-xl font-bold text-[#96321F]">
              {(profile.display_name ?? profile.email ?? '?')[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-[#242622]">{profile.full_name ?? profile.display_name ?? 'Unnamed'}</h1>
            {profile.display_name && profile.full_name && profile.display_name !== profile.full_name && (
              <p className="text-xs text-[#9E8F7E]">Goes by: {profile.display_name}</p>
            )}
            <p className="text-sm text-[#7E613F]">{profile.email}</p>
            {profile.phone && <p className="text-sm text-[#7E613F]">{profile.phone}</p>}
          </div>
          <span className="text-xs bg-[#EDE9DC] text-[#7E613F] px-2.5 py-1 rounded-full capitalize font-medium">
            {profile.tier ?? 'newcomer'}
          </span>
        </div>

        {/* Points */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="bg-[#F7F5EF] rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-[#7E613F] mb-1">App Points</p>
            <p className="text-2xl font-bold text-[#96321F]">{balance.toLocaleString()}</p>
          </div>
          <div className="bg-[#F7F5EF] rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-[#7E613F] mb-1">Toast Loyalty</p>
            <p className="text-2xl font-bold text-[#242622]">{(toastAccount?.toast_points ?? 0).toLocaleString()}</p>
          </div>
        </div>

        {toastAccount?.last_trans_at && (
          <p className="text-xs text-[#9E8F7E]">
            Last Toast visit: {new Date(toastAccount.last_trans_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* Redeem a reward */}
      <section>
        <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-3">Redeem a Reward</h2>
        <RedeemPanel
          userId={id}
          balance={balance}
          rewards={(rewards ?? []) as any}
        />
      </section>

      {/* Redemption history */}
      {(redemptions ?? []).length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-3">Redemption History</h2>
          <div className="space-y-2">
            {(redemptions ?? []).map((r: any) => (
              <div key={r.id} className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-xl">{r.rewards?.icon ?? '🎁'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#242622]">{r.rewards?.name ?? 'Reward'}</p>
                  {r.notes && <p className="text-xs text-[#9E8F7E] truncate">{r.notes}</p>}
                  <p className="text-xs text-[#9E8F7E]">
                    {r.status === 'redeemed'
                      ? `Redeemed ${r.redeemed_at ? new Date(r.redeemed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}`
                      : r.status === 'pending' ? 'Pending' : r.status}
                    {r.profiles?.display_name ? ` by ${r.profiles.display_name}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {r.rewards?.points_cost > 0 && (
                    <p className="text-sm font-bold text-red-500">−{r.rewards.points_cost} pts</p>
                  )}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    r.status === 'redeemed' ? 'bg-green-100 text-green-700' :
                    r.status === 'pending'  ? 'bg-yellow-100 text-yellow-700' :
                    'bg-[#F1F1E7] text-[#9E8F7E]'
                  }`}>
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent point activity */}
      <section>
        <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-3">Recent Activity</h2>
        <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl overflow-hidden divide-y divide-[#F1F1E7]">
          {(recentEarns ?? []).length === 0 ? (
            <p className="text-xs text-[#9E8F7E] px-4 py-3">No activity yet</p>
          ) : (recentEarns ?? []).map((e: any) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1">
                <p className="text-xs text-[#242622]">{e.notes ?? e.event_type.replace(/_/g, ' ')}</p>
                <p className="text-[10px] text-[#9E8F7E]">
                  {new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
              <p className={`text-sm font-bold ${e.points_delta >= 0 ? 'text-[#87A67F]' : 'text-red-500'}`}>
                {e.points_delta >= 0 ? '+' : ''}{e.points_delta} pts
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
