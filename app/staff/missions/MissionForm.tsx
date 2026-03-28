'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const TRIGGERS = [
  { value: 'manual_staff',        label: 'Manual (staff marks)' },
  { value: 'qr_scan',             label: 'QR scan' },
  { value: 'event_attendance',    label: 'Event attendance' },
  { value: 'toast_purchase',      label: 'Toast purchase' },
  { value: 'journal_entry',       label: 'Journal entry' },
  { value: 'challenge_completion',label: 'Challenge completion' },
]

const TIERS = [
  { value: 'newcomer',  label: 'Fingerling' },
  { value: 'regular',   label: 'Shanty' },
  { value: 'spearer',   label: 'Spearer' },
  { value: 'harpooner', label: 'Harpooner' },
  { value: 'captain',   label: 'Captain' },
]

type Mission = {
  id: string
  slug: string
  title: string
  description: string | null
  icon: string
  points: number
  completion_trigger: string
  is_repeatable: boolean
  repeat_limit: number | null
  repeat_cooldown_days: number | null
  min_tier: string
  is_active: boolean
  sort_order: number
}

export default function MissionForm({ existing }: { existing: Mission | null }) {
  const router = useRouter()
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]     = useState('')

  const [title,       setTitle]       = useState(existing?.title ?? '')
  const [slug,        setSlug]        = useState(existing?.slug ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [icon,        setIcon]        = useState(existing?.icon ?? '🎯')
  const [points,      setPoints]      = useState(existing?.points ?? 50)
  const [trigger,     setTrigger]     = useState(existing?.completion_trigger ?? 'manual_staff')
  const [repeatable,  setRepeatable]  = useState(existing?.is_repeatable ?? false)
  const [repeatLimit, setRepeatLimit] = useState(existing?.repeat_limit ?? '')
  const [cooldown,    setCooldown]    = useState(existing?.repeat_cooldown_days ?? '')
  const [minTier,     setMinTier]     = useState(existing?.min_tier ?? 'newcomer')
  const [isActive,    setIsActive]    = useState(existing?.is_active ?? true)
  const [sortOrder,   setSortOrder]   = useState(existing?.sort_order ?? 0)

  function autoSlug(val: string) {
    return val.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  }

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return }
    if (!slug.trim())  { setError('Slug is required'); return }
    setSaving(true); setError('')

    const body = {
      ...(existing ? { id: existing.id } : {}),
      slug:                 slug.trim(),
      title:                title.trim(),
      description:          description.trim() || null,
      icon:                 icon.trim() || '🎯',
      points:               Number(points),
      completion_trigger:   trigger,
      is_repeatable:        repeatable,
      repeat_limit:         repeatable && repeatLimit !== '' ? Number(repeatLimit) : null,
      repeat_cooldown_days: repeatable && cooldown !== '' ? Number(cooldown) : null,
      min_tier:             minTier,
      is_active:            isActive,
      sort_order:           Number(sortOrder),
    }

    const res = await fetch('/api/staff/mission', {
      method: existing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Save failed'); setSaving(false); return }
    router.push('/staff/missions')
    router.refresh()
  }

  async function handleDelete() {
    if (!existing) return
    if (!confirm('Delete this mission? If members have completed it, it will be deactivated instead.')) return
    setDeleting(true)
    const res = await fetch('/api/staff/mission', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: existing.id }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Delete failed'); setDeleting(false); return }
    router.push('/staff/missions')
    router.refresh()
  }

  const inputCls = "w-full bg-white border border-[#C8BCA4] rounded-lg px-3 py-2.5 text-[#242622] text-sm focus:outline-none focus:border-[#96321F]"
  const labelCls = "block text-xs text-[#7E613F] uppercase tracking-widest mb-1.5"

  return (
    <div className="space-y-5 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#242622]">
          {existing ? 'Edit Mission' : 'New Mission'}
        </h1>
        <button onClick={() => router.back()} className="text-sm text-[#7E613F] hover:text-[#242622]">
          ← Back
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <div className="bg-white border border-[#D4CFC3] rounded-2xl p-4 space-y-4">

        <div className="flex gap-3">
          <div className="w-20">
            <label className={labelCls}>Icon</label>
            <input value={icon} onChange={e => setIcon(e.target.value)}
              className={inputCls + " text-center text-2xl"} maxLength={4} />
          </div>
          <div className="flex-1">
            <label className={labelCls}>Title</label>
            <input value={title} onChange={e => {
              setTitle(e.target.value)
              if (!existing) setSlug(autoSlug(e.target.value))
            }} className={inputCls} placeholder="Try the Rye" />
          </div>
        </div>

        <div>
          <label className={labelCls}>Slug <span className="normal-case text-[#9E8F7E]">(unique id, no spaces)</span></label>
          <input value={slug} onChange={e => setSlug(e.target.value)}
            className={inputCls + " font-mono text-xs"} placeholder="try_the_rye" />
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={2} className={inputCls + " resize-none"} placeholder="Order a flight of our rye whiskeys" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Points</label>
            <input type="number" value={points} onChange={e => setPoints(Number(e.target.value))}
              className={inputCls} min={0} />
          </div>
          <div>
            <label className={labelCls}>Sort order</label>
            <input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))}
              className={inputCls} min={0} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Completion trigger</label>
          <select value={trigger} onChange={e => setTrigger(e.target.value)} className={inputCls}>
            {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>Minimum tier</label>
          <select value={minTier} onChange={e => setMinTier(e.target.value)} className={inputCls}>
            {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {/* Repeatable */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={repeatable} onChange={e => setRepeatable(e.target.checked)}
              className="w-4 h-4 accent-[#96321F]" />
            <span className="text-sm text-[#242622]">Repeatable</span>
          </label>
          {repeatable && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className={labelCls}>Max completions <span className="normal-case">(blank = unlimited)</span></label>
                <input type="number" value={repeatLimit} onChange={e => setRepeatLimit(e.target.value)}
                  className={inputCls} min={1} placeholder="—" />
              </div>
              <div>
                <label className={labelCls}>Cooldown days</label>
                <input type="number" value={cooldown} onChange={e => setCooldown(e.target.value)}
                  className={inputCls} min={0} placeholder="0" />
              </div>
            </div>
          )}
        </div>

        {/* Active toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}
            className="w-4 h-4 accent-[#96321F]" />
          <span className="text-sm text-[#242622]">Active</span>
        </label>
      </div>

      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 bg-[#96321F] text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50 hover:bg-[#ae3a24] transition-colors">
          {saving ? 'Saving…' : existing ? 'Save changes' : 'Create mission'}
        </button>
        {existing && (
          <button onClick={handleDelete} disabled={deleting}
            className="px-4 py-3 bg-[#F1F1E7] text-[#96321F] font-semibold rounded-xl text-sm disabled:opacity-50 hover:bg-[#D4CFC3] transition-colors">
            {deleting ? '…' : 'Delete'}
          </button>
        )}
      </div>
    </div>
  )
}
