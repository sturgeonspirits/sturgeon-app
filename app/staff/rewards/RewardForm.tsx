'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const REDEMPTION_METHODS = [
  { value: 'points',      label: 'Points',       desc: 'Customer spends points to redeem' },
  { value: 'staff_grant', label: 'Staff Grant',  desc: 'Staff manually awards this reward' },
  { value: 'leaderboard', label: 'Leaderboard',  desc: 'Awarded for leaderboard placement' },
  { value: 'milestone',   label: 'Milestone',    desc: 'Awarded at a points milestone'     },
  { value: 'tier_unlock', label: 'Tier Unlock',  desc: 'Unlocked at a specific tier'       },
]

const REWARD_TYPES = [
  { value: 'drink',        label: '🍸 Drink'         },
  { value: 'discount',     label: '💸 Discount'      },
  { value: 'merchandise',  label: '👕 Merch'         },
  { value: 'experience',   label: '🎟 Experience'    },
  { value: 'points_bonus', label: '⭐ Points Bonus'  },
  { value: 'custom',       label: '🎁 Custom'        },
]

const TIERS = ['newcomer', 'regular', 'devotee', 'legend']

interface Reward {
  id: string
  name: string
  description: string | null
  icon: string | null
  redemption_method: string
  points_cost: number | null
  reward_type: string
  reward_value: string | null
  is_active: boolean | null
  max_per_user: number | null
  total_supply: number | null
  tier_required: string | null
  sort_order: number | null
  expires_at: string | null
}

interface Props {
  existing: Reward | null
}

export default function RewardForm({ existing }: Props) {
  const router  = useRouter()
  const isNew   = !existing

  const [name,       setName]      = useState(existing?.name ?? '')
  const [desc,       setDesc]      = useState(existing?.description ?? '')
  const [icon,       setIcon]      = useState(existing?.icon ?? '🎁')
  const [method,     setMethod]    = useState(existing?.redemption_method ?? 'points')
  const [points,     setPoints]    = useState<number | ''>(existing?.points_cost ?? '')
  const [type,       setType]      = useState(existing?.reward_type ?? 'drink')
  const [value,      setValue]     = useState(existing?.reward_value ?? '')
  const [active,     setActive]    = useState(existing?.is_active ?? true)
  const [maxPerUser, setMaxPerUser] = useState<number | ''>(existing?.max_per_user ?? '')
  const [supply,     setSupply]    = useState<number | ''>(existing?.total_supply ?? '')
  const [tier,       setTier]      = useState(existing?.tier_required ?? 'newcomer')
  const [sortOrder,  setSortOrder] = useState<number | ''>(existing?.sort_order ?? '')
  const [expiresAt,  setExpiresAt] = useState(existing?.expires_at ? existing.expires_at.slice(0, 10) : '')

  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const inputCls = "w-full border border-[#D4CFC3] rounded-xl px-3 py-2.5 text-sm text-[#242622] bg-[#FFFFFF] focus:outline-none focus:border-[#96321F] transition-colors"
  const labelCls = "block text-xs font-semibold text-[#7E613F] uppercase tracking-wide mb-1.5"

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const body = {
        id:                 existing?.id,
        name,
        description:        desc || null,
        icon:               icon || '🎁',
        redemption_method:  method,
        points_cost:        points === '' ? 0 : Number(points),
        reward_type:        type,
        reward_value:       value || null,
        is_active:          active,
        max_per_user:       maxPerUser === '' ? null : Number(maxPerUser),
        total_supply:       supply === '' ? null : Number(supply),
        tier_required:      tier || 'newcomer',
        sort_order:         sortOrder === '' ? null : Number(sortOrder),
        expires_at:         expiresAt || null,
      }
      const res = await fetch('/api/staff/reward', {
        method:  isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save')
      router.push('/staff/rewards')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!existing) return
    if (!confirm(`Delete "${existing.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch('/api/staff/reward', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: existing.id }),
      })
      if (!res.ok) throw new Error('Delete failed')
      router.push('/staff/rewards')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">

      {/* Name + Icon */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelCls}>Reward Name</label>
          <input required value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Free Well Drink" className={inputCls} />
        </div>
        <div className="w-24">
          <label className={labelCls}>Emoji</label>
          <input value={icon} onChange={e => setIcon(e.target.value)}
            placeholder="🎁" className={inputCls + ' text-center text-xl'} maxLength={4} />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className={labelCls}>Description</label>
        <textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="What does the customer get?" className={inputCls + ' resize-none'} />
      </div>

      {/* Redemption method */}
      <div>
        <label className={labelCls}>How it's redeemed</label>
        <div className="space-y-2">
          {REDEMPTION_METHODS.map(m => (
            <button key={m.value} type="button" onClick={() => setMethod(m.value)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                method === m.value
                  ? 'border-[#96321F] bg-[#96321F]/5'
                  : 'border-[#D4CFC3] bg-white hover:border-[#C8BCA4]'
              }`}>
              <span className={`text-xs font-semibold ${method === m.value ? 'text-[#96321F]' : 'text-[#242622]'}`}>
                {m.label}
              </span>
              <span className="text-[10px] text-[#9E8F7E] ml-2">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Points cost — only relevant for points redemption */}
      {method === 'points' && (
        <div>
          <label className={labelCls}>Points Cost</label>
          <input type="number" min={0} value={points} onChange={e => setPoints(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="e.g. 500" className={inputCls} />
        </div>
      )}

      {/* Reward type */}
      <div>
        <label className={labelCls}>Reward Type</label>
        <div className="grid grid-cols-3 gap-2">
          {REWARD_TYPES.map(t => (
            <button key={t.value} type="button" onClick={() => setType(t.value)}
              className={`text-center py-2.5 px-2 rounded-xl border text-xs font-semibold transition-colors ${
                type === t.value
                  ? 'border-[#96321F] bg-[#96321F]/5 text-[#96321F]'
                  : 'border-[#D4CFC3] bg-white text-[#242622] hover:border-[#C8BCA4]'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reward value */}
      <div>
        <label className={labelCls}>Reward Value <span className="normal-case font-normal text-[#9E8F7E]">(optional detail)</span></label>
        <input value={value} onChange={e => setValue(e.target.value)}
          placeholder={type === 'discount' ? 'e.g. 20% off' : type === 'points_bonus' ? 'e.g. 200 bonus pts' : 'e.g. any well drink or beer'}
          className={inputCls} />
      </div>

      {/* Tier required */}
      <div>
        <label className={labelCls}>Minimum Tier</label>
        <select value={tier} onChange={e => setTier(e.target.value)} className={inputCls}>
          {TIERS.map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Limits */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Max Per Member</label>
          <input type="number" min={1} value={maxPerUser}
            onChange={e => setMaxPerUser(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Unlimited" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Total Supply</label>
          <input type="number" min={1} value={supply}
            onChange={e => setSupply(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Unlimited" className={inputCls} />
        </div>
      </div>

      {/* Sort + Expires */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Sort Order</label>
          <input type="number" min={0} value={sortOrder}
            onChange={e => setSortOrder(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="0" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Expires On</label>
          <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* Active toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div onClick={() => setActive(!active)}
          className={`relative w-11 h-6 rounded-full transition-colors ${active ? 'bg-[#87A67F]' : 'bg-[#D4CFC3]'}`}>
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${active ? 'translate-x-5' : ''}`} />
        </div>
        <span className="text-sm text-[#242622] font-medium">
          {active ? 'Active — visible to customers' : 'Inactive — hidden from customers'}
        </span>
      </label>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="flex-1 bg-[#96321F] text-white font-bold py-3 rounded-xl hover:bg-[#ae3a24] disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : isNew ? 'Create Reward' : 'Save Changes'}
        </button>
        <button type="button" onClick={() => router.push('/staff/rewards')}
          className="px-5 py-3 rounded-xl bg-[#EDE9DC] text-[#7E613F] font-semibold hover:bg-[#D4CFC3] transition-colors text-sm">
          Cancel
        </button>
      </div>

      {!isNew && (
        <div className="pt-2 border-t border-[#D4CFC3]">
          <button type="button" onClick={handleDelete} disabled={deleting}
            className="text-sm text-red-600 hover:text-red-700 font-semibold disabled:opacity-50">
            {deleting ? 'Deleting…' : '🗑 Delete this reward'}
          </button>
        </div>
      )}
    </form>
  )
}
