import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function RewardsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: rewards }, { data: ledger }, { data: myRedemptions }] = await Promise.all([
    supabase.from('rewards').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('points_ledger').select('balance').eq('user_id', user.id).single(),
    supabase
      .from('reward_redemptions')
      .select('*, rewards(name, icon)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const balance = ledger?.balance ?? 0

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
        <h1 className="font-display text-xl font-bold text-[#F1F1E7]">Rewards</h1>
        <p className="text-sm text-[#7a6e5f] mt-1">
          Your balance: <span className="text-[#96321F] font-bold">{balance.toLocaleString()} pts</span>
        </p>
      </div>

      {/* Pending redemptions */}
      {(myRedemptions ?? []).filter(r => r.status === 'pending').length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[#7a6e5f] uppercase tracking-widest mb-3">Ready to Redeem</h2>
          <div className="space-y-2">
            {myRedemptions!.filter(r => r.status === 'pending').map(r => (
              <div key={r.id} className="bg-[#96321F]/10 border border-[#96321F]/30 rounded-xl p-4 flex items-center gap-3">
                <span className="text-2xl">{(r.rewards as any)?.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-[#F1F1E7] text-sm">{(r.rewards as any)?.name}</p>
                  <p className="text-xs text-[#7a6e5f]">Show this to staff to claim</p>
                </div>
                <span className="text-[#96321F] text-xl">→</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All rewards */}
      <section>
        <h2 className="text-xs font-semibold text-[#7a6e5f] uppercase tracking-widest mb-3">All Rewards</h2>
        <div className="space-y-3">
          {(rewards ?? []).map(reward => {
            const canAfford = reward.redemption_method === 'points' ? balance >= reward.points_cost : null
            return (
              <div key={reward.id} className="bg-[#161410] border border-[#2c2820] rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{reward.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-[#F1F1E7] text-sm">{reward.name}</p>
                    {reward.description && (
                      <p className="text-xs text-[#7a6e5f] mt-0.5">{reward.description}</p>
                    )}
                    <p className="text-xs text-[#3a3228] mt-1">{reward.reward_value}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs bg-[#2c2820] text-[#7a6e5f] px-2 py-0.5 rounded-full">
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
        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#96321F] text-[#F1F1E7] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#ae3a24] transition-colors"
      >
        {pointsCost.toLocaleString()} pts
      </button>
    </form>
  )
}
