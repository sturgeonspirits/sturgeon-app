import type { TierThreshold, UserTier } from '@/lib/supabase/types'
import { tierLabel } from '@/lib/utils'

interface Props {
  currentTier: UserTier
  lifetimeEarned: number
  tiers: TierThreshold[]
}

export default function TierProgress({ currentTier, lifetimeEarned, tiers }: Props) {
  const sortedTiers = [...tiers].sort((a, b) => a.min_lifetime - b.min_lifetime)
  const currentIdx  = sortedTiers.findIndex(t => t.tier === currentTier)
  const nextTier    = sortedTiers[currentIdx + 1]

  if (!nextTier) {
    // Captain — max tier
    return (
      <div className="bg-[#1a1a1a] border border-[#b06aff]/40 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">⚓</span>
          <p className="font-bold text-[#b06aff]">Captain</p>
        </div>
        <p className="text-xs text-gray-500">You've reached the highest tier. Legendary.</p>
      </div>
    )
  }

  const current = sortedTiers[currentIdx]
  const progress = Math.min(
    100,
    Math.round(((lifetimeEarned - current.min_lifetime) / (nextTier.min_lifetime - current.min_lifetime)) * 100)
  )
  const remaining = nextTier.min_lifetime - lifetimeEarned

  return (
    <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Current tier</p>
          <p className="font-semibold text-sm" style={{ color: current.color }}>
            {tierLabel(currentTier)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 mb-0.5">Next tier</p>
          <p className="font-semibold text-sm" style={{ color: nextTier.color }}>
            {nextTier.label}
          </p>
        </div>
      </div>

      <div className="h-2 bg-[#2e2e2e] rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, backgroundColor: nextTier.color }}
        />
      </div>

      <p className="text-xs text-gray-600">
        <span className="text-white font-medium">{remaining.toLocaleString()} pts</span> to {nextTier.label}
      </p>
    </div>
  )
}
