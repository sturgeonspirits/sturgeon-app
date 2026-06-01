import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import RewardToggle from './RewardToggle'
import { Medal } from '@/components/icons/brand'

export const dynamic = 'force-dynamic'

const METHOD_LABELS: Record<string, string> = {
  points:       'Points',
  staff_grant:  'Staff Grant',
  leaderboard:  'Leaderboard',
  milestone:    'Milestone',
  streak:       'Streak',
  tier_unlock:  'Tier Unlock',
}

const TYPE_LABELS: Record<string, string> = {
  drink:        'Drink',
  discount:     'Discount',
  merchandise:  'Merch',
  experience:   'Experience',
  points_bonus: 'Points Bonus',
  custom:       'Custom',
}

export default async function StaffRewardsPage() {
  const service = createServiceClient()
  const { data: rewards } = await service
    .from('rewards')
    .select('*')
    .order('sort_order')
    .order('name')

  const active   = (rewards ?? []).filter(r => r.is_active)
  const inactive = (rewards ?? []).filter(r => !r.is_active)

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center justify-between pt-4">
        <div>
          <h1 className="font-display text-xl font-bold text-[#242622]">Rewards</h1>
          <p className="text-sm text-[#7E613F] mt-0.5">Manage redeemable rewards</p>
        </div>
        <Link
          href="/staff/rewards/new"
          className="bg-[#96321F] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#ae3a24] transition-colors"
        >
          + New
        </Link>
      </div>

      {(rewards ?? []).length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-[#D4CFC3]">
          <Medal size={44} className="text-[#D4CFC3] mx-auto mb-3" />
          <p className="font-semibold text-[#242622] mb-1">No rewards yet</p>
          <p className="text-sm text-[#7E613F]">Create your first reward to get started.</p>
          <Link href="/staff/rewards/new" className="inline-block mt-4 text-sm text-[#96321F] font-semibold underline">
            Create a reward →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active */}
          {active.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#7E613F] uppercase tracking-wide">Active · {active.length}</p>
              {active.map(r => (
                <RewardCard key={r.id} reward={r} />
              ))}
            </div>
          )}

          {/* Inactive */}
          {inactive.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#9E8F7E] uppercase tracking-wide">Inactive · {inactive.length}</p>
              {inactive.map(r => (
                <RewardCard key={r.id} reward={r} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RewardCard({ reward }: { reward: any }) {
  return (
    <div className={`bg-white border rounded-2xl p-4 ${reward.is_active ? 'border-[#D4CFC3]' : 'border-[#E8E4DA] opacity-60'}`}>
      <div className="flex items-start gap-3">
        {reward.icon
          ? <span className="text-2xl mt-0.5 shrink-0">{reward.icon}</span>
          : <Medal size={24} className="text-[#7E613F] mt-0.5 shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-[#242622] text-sm">{reward.name}</p>
            <span className="text-[10px] font-semibold text-[#7E613F] bg-[#F1F1E7] border border-[#D4CFC3] rounded px-1.5 py-0.5">
              {METHOD_LABELS[reward.redemption_method] ?? reward.redemption_method}
            </span>
            <span className="text-[10px] font-semibold text-[#7E613F] bg-[#F1F1E7] border border-[#D4CFC3] rounded px-1.5 py-0.5">
              {TYPE_LABELS[reward.reward_type] ?? reward.reward_type}
            </span>
          </div>
          {reward.description && (
            <p className="text-xs text-[#7E613F] mt-0.5 line-clamp-2">{reward.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-xs text-[#9E8F7E]">
            {reward.points_cost > 0 && (
              <span className="font-semibold text-[#96321F]">{reward.points_cost.toLocaleString()} pts</span>
            )}
            {reward.tier_required && reward.tier_required !== 'newcomer' && (
              <span>Tier: {reward.tier_required}</span>
            )}
            {reward.max_per_user && (
              <span>Max {reward.max_per_user}/member</span>
            )}
            {reward.total_supply && (
              <span>{reward.redeemed_count ?? 0}/{reward.total_supply} used</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <RewardToggle id={reward.id} isActive={reward.is_active} />
          <Link
            href={`/staff/rewards/${reward.id}`}
            className="text-xs text-[#7E613F] border border-[#D4CFC3] rounded-lg px-3 py-1.5 hover:border-[#96321F] hover:text-[#96321F] transition-colors font-medium"
          >
            Edit
          </Link>
        </div>
      </div>
    </div>
  )
}
