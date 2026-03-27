import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function RewardsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: rewards }, { data: ledger }, { data: myRedemptions }, { data: toastAccount }, { data: toastEarnEvents }] = await Promise.all([
    supabase.from('rewards').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('points_ledger').select('balance').eq('user_id', user.id).single(),
    supabase
      .from('reward_redemptions')
      .select('*, rewards(name, icon, points_cost)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('toast_loyalty_accounts')
      .select('toast_points')
      .eq('profile_id', user.id)
      .maybeSingle(),
    supabase
      .from('earn_events')
      .select('points_delta')
      .eq('user_id', user.id)
      .eq('context_type', 'toast_import'),
  ])

  const toastPts   = toastAccount?.toast_points ?? 0
  const appPts     = (ledger?.balance ?? 0) - (toastEarnEvents ?? []).reduce((s, e) => s + (e.points_delta ?? 0), 0)
  const balance    = ledger?.balance ?? 0

  const METHOD_LABEL: Record<string, string> = {
    points:      'Redeem with points',
    leaderboard: 'Win at events',
    milestone:   'Career milestone',
    streak:      'Winning streak',
    tier_unlock: 'Tier reward',
    staff_grant: 'Staff awarded',
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div className="pt-4">
        <h1 className="font-display text-xl font-bold text-[#242622]">Rewards</h1>
      </div>

      {/* Points breakdown */}
      <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🥂</span>
            <span className="text-sm text-[#7E613F]">Toast Loyalty</span>
          </div>
          <span className="font-bold text-[#242622]">{toastPts.toLocaleString()} pts</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📱</span>
            <span className="text-sm text-[#7E613F]">App Loyalty</span>
          </div>
          <span className="font-bold text-[#242622]">{Math.max(0, appPts).toLocaleString()} pts</span>
        </div>
        <div className="border-t border-[#D4CFC3] pt-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-[#242622]">Total</span>
          <span className="text-lg font-bold text-[#96321F]">{balance.toLocaleString()} pts</span>
        </div>
      </div>

      {/* Pending redemptions */}
      {(myRedemptions ?? []).filter(r => r.status === 'pending').length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-3">Ready to Redeem</h2>
          <div className="space-y-2">
            {myRedemptions!.filter(r => r.status === 'pending').map(r => (
              <div key={r.id} className="bg-[#96321F]/10 border border-[#96321F]/30 rounded-xl p-4 flex items-center gap-3">
                <span className="text-2xl">{(r.rewards as any)?.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-[#242622] text-sm">{(r.rewards as any)?.name}</p>
                  <p className="text-xs text-[#7E613F]">Show this to staff to claim</p>
                </div>
                <span className="text-[#96321F] text-xl">→</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Redemption history */}
      {(myRedemptions ?? []).filter(r => r.status === 'redeemed').length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-3">Redemption History</h2>
          <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl overflow-hidden divide-y divide-[#F1F1E7]">
            {(myRedemptions ?? []).filter(r => r.status === 'redeemed').map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-xl">{(r.rewards as any)?.icon ?? '🎁'}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#242622]">{(r.rewards as any)?.name}</p>
                  <p className="text-xs text-[#9E8F7E]">
                    {r.redeemed_at
                      ? new Date(r.redeemed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                      : new Date(r.created_at!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                {((r.rewards as any)?.points_cost ?? 0) > 0 && (
                  <p className="text-sm font-bold text-red-400">−{(r.rewards as any).points_cost} pts</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All rewards */}
      <section>
        <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-3">All Rewards</h2>
        <div className="space-y-3">
          {(rewards ?? []).map(reward => {
            const canAfford = reward.redemption_method === 'points' ? balance >= reward.points_cost : null
            return (
              <div key={reward.id} className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{reward.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-[#242622] text-sm">{reward.name}</p>
                    {reward.description && (
                      <p className="text-xs text-[#7E613F] mt-0.5">{reward.description}</p>
                    )}
                    <p className="text-xs text-[#9E8F7E] mt-1">{reward.reward_value}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs bg-[#EDE9DC] text-[#7E613F] px-2 py-0.5 rounded-full">
                        {METHOD_LABEL[reward.redemption_method]}
                      </span>
                      {reward.redemption_method === 'points' && (
                        <RedeemButton
                          rewardId={reward.id}
                          pointsCost={reward.points_cost}
                          canAfford={!!canAfford}
                          userId={user.id}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function RedeemButton({ rewardId, pointsCost, canAfford, userId }: {
  rewardId: string; pointsCost: number; canAfford: boolean; userId: string
}) {
  return (
    <form action="/api/rewards/redeem" method="POST">
      <input type="hidden" name="rewardId" value={rewardId} />
      <input type="hidden" name="userId"   value={userId} />
      <button
        type="submit"
        disabled={!canAfford}
        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#96321F] text-[#FFFFFF] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#ae3a24] transition-colors"
      >
        {pointsCost.toLocaleString()} pts
      </button>
    </form>
  )
}
