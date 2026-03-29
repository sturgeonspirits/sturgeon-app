'use client'

import { useState } from 'react'

interface Reward {
  id: string
  name: string
  icon: string
  description: string | null
  points_cost: number
  reward_value: string | null
  redemption_method: string
}

interface Props {
  userId:  string
  balance: number
  rewards: Reward[]
}

export default function RedeemPanel({ userId, balance, rewards }: Props) {
  const [selected,   setSelected]   = useState<Reward | null>(null)
  const [notes,      setNotes]      = useState('')
  const [saving,     setSaving]     = useState(false)
  const [message,    setMessage]    = useState('')
  const [newBalance, setNewBalance] = useState(balance)

  // Only show redeemable rewards (points-based or staff_grant)
  const redeemable = rewards.filter(r =>
    r.redemption_method === 'points' || r.redemption_method === 'staff_grant'
  )

  async function handleRedeem() {
    if (!selected) return
    setSaving(true)
    setMessage('')

    const res = await fetch('/api/staff/redeem', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId, rewardId: selected.id, notes: notes.trim() || undefined }),
    })
    const json = await res.json()

    if (res.ok) {
      setNewBalance(b => b - (selected.points_cost ?? 0))
      setMessage(`✓ ${selected.name} redeemed`)
      setSelected(null)
      setNotes('')
      setTimeout(() => setMessage(''), 4000)
    } else {
      setMessage(`Error: ${json.error}`)
    }
    setSaving(false)
  }

  if (redeemable.length === 0) {
    return (
      <p className="text-xs text-[#9E8F7E]">
        No rewards available to grant. Add rewards with method "Points" or "Staff grant" in the{' '}
        <a href="/staff/rewards" className="text-[#96321F] hover:underline">Rewards catalog</a>.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {/* Current balance */}
      <div className="bg-[#F7F5EF] rounded-xl px-4 py-2 flex items-center justify-between">
        <span className="text-xs text-[#7E613F]">Available balance</span>
        <span className="text-sm font-bold text-[#96321F]">{newBalance.toLocaleString()} pts</span>
      </div>

      {/* Reward picker */}
      <div className="grid gap-2">
        {redeemable.map(r => {
          const canAfford = r.points_cost === 0 || newBalance >= r.points_cost
          const isSelected = selected?.id === r.id
          return (
            <button
              key={r.id}
              onClick={() => setSelected(isSelected ? null : r)}
              disabled={!canAfford}
              className={`w-full text-left border rounded-xl px-4 py-3 flex items-center gap-3 transition-all ${
                isSelected
                  ? 'border-[#96321F] bg-[#96321F]/5'
                  : canAfford
                  ? 'border-[#D4CFC3] bg-[#FFFFFF] hover:border-[#96321F]/40'
                  : 'border-[#D4CFC3] bg-[#F7F5EF] opacity-50 cursor-not-allowed'
              }`}
            >
              <span className="text-2xl">{r.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#242622]">{r.name}</p>
                {r.description && <p className="text-xs text-[#7E613F] truncate">{r.description}</p>}
                {r.reward_value && <p className="text-xs text-[#9E8F7E]">{r.reward_value}</p>}
              </div>
              <div className="text-right shrink-0">
                {r.points_cost > 0 ? (
                  <span className={`text-sm font-bold ${canAfford ? 'text-[#96321F]' : 'text-[#9E8F7E]'}`}>
                    {r.points_cost.toLocaleString()} pts
                  </span>
                ) : (
                  <span className="text-xs text-[#87A67F] font-semibold">Free</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Confirm panel */}
      {selected && (
        <div className="bg-[#FFFFFF] border border-[#96321F]/30 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-[#242622]">
            Redeeming: {selected.icon} {selected.name}
          </p>
          {selected.points_cost > 0 && (
            <p className="text-xs text-[#7E613F]">
              Will deduct <strong>{selected.points_cost.toLocaleString()} pts</strong> →
              new balance: <strong>{(newBalance - selected.points_cost).toLocaleString()} pts</strong>
            </p>
          )}
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Note (optional) — e.g. 'at bar, table 4'"
            className="w-full border border-[#D4CFC3] rounded-lg px-3 py-2 text-sm text-[#242622] placeholder-[#C8BCA4] focus:outline-none focus:border-[#96321F] transition-colors"
          />
          <div className="flex gap-2">
            <button
              onClick={handleRedeem}
              disabled={saving}
              className="flex-1 bg-[#96321F] text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-40 hover:bg-[#ae3a24] transition-colors"
            >
              {saving ? 'Processing…' : 'Confirm Redemption'}
            </button>
            <button
              onClick={() => { setSelected(null); setNotes('') }}
              className="px-4 py-2.5 rounded-xl border border-[#D4CFC3] text-sm text-[#7E613F] hover:bg-[#F1F1E7] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={`text-sm text-center font-medium ${message.startsWith('Error') ? 'text-red-600' : 'text-[#87A67F]'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
