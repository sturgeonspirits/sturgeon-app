import type { TierThreshold, UserTier } from '@/lib/supabase/types'
import { tierLabel } from '@/lib/utils'

interface Props {
  currentTier: UserTier
  lifetimeEarned: number
  tiers: TierThreshold[]
}

// Brand-aligned tier colors
const TIER_COLORS: Record<string, string> = {
  newcomer:  '#7a6e5f',
  regular:   '#87A67F',   // olive
  spearer:   '#C8BCA4',   // tan
  harpooner: '#7E613F',   // brown
  captain:   '#96321F',   // rust
}

export default function TierProgress({ currentTier, lifetimeEarned, tiers }: Props) {
  const sortedTiers = [...tiers].sort((a, b) => a.min_lifetime - b.min_lifetime)
  const currentIdx  = sortedTiers.findIndex(t => t.tier === currentTier)
  const nextTier    = sortedTiers[currentIdx + 1]

  if (!nextTier) {
    // Captain — max tier
    return (
      <div className="bg-[#161410] border border-[#96321F]/35 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">⚓</span>
          <p className="font-bold text-[#96321F]">Captain</p>
        </div>
        <p className="text-xs text-[#7a6e5f]">You've reached the highest tier. Legendary.</p>
      </div>
    )
  }

  const current  = sortedTiers[currentIdx]
  const progress = Math.min(
    100,
    Math.round(((lifetimeEarned - current.min_lifetime) / (nextTier.min_lifetime - current.min_lifetime)) * 100)
  )
  const remaining  = nextTier.min_lifetime - lifetimeEarned
  const tierColor  = TIER_COLORS[currentTier]  ?? current.color
  const nextColor  = TIER_COLORS[nextTier.tier] ?? nextTier.color

  return (
    <div className="bg-[#161410] border border-[#2c2820] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-[#7a6e5f] mb-0.5">Current tier</p>
          <p className="font-semibold text-sm" style={{ color: tierColor }}>
            {tierLabel(currentTier)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#7a6e5f] mb-0.5">Next tier</p>
          <p className="font-semibold text-sm" style={{ color: nextColor }}>
            {nextTier.label}
          </p>
        </div>
      </div>

      <div className="h-1.5 bg-[#2c2820] rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, backgroundColor: nextColor }}
        />
      </div>

      <p className="text-xs text-[#7a6e5f]">
        <span className="text-[#F1F1E7] font-medium">{remaining.toLocaleString()} pts</span> to {nextTier.label}
      </p>
    </div>
  )
}
