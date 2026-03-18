import { formatPoints, tierLabel, tierColor } from '@/lib/utils'

interface Props {
  balance: number
  tier: string
}

export default function PointsBadge({ balance, tier }: Props) {
  return (
    <div className="text-right">
      <p className="text-2xl font-bold text-[#f5c842]">{formatPoints(balance)}</p>
      <p className="text-xs font-medium mt-0.5" style={{ color: tierColor(tier) }}>
        {tierLabel(tier)}
      </p>
    </div>
  )
}
