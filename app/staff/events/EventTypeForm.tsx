'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface EventType {
  id: string
  name: string
  slug: string | null
  icon: string | null
  day_of_week: number | null
  typical_time: string | null
  description: string | null
  is_active: boolean
  sort_order: number | null
}

interface Props {
  existing: EventType | null
}

export default function EventTypeForm({ existing }: Props) {
  const router = useRouter()
  const isNew = !existing

  const [name,         setName]        = useState(existing?.name ?? '')
  const [slug,         setSlug]        = useState(existing?.slug ?? '')
  const [icon,         setIcon]        = useState(existing?.icon ?? '📅')
  const [dayOfWeek,    setDayOfWeek]   = useState<number | ''>(existing?.day_of_week ?? '')
  const [typicalTime,  setTypicalTime] = useState(existing?.typical_time ?? '')
  const [description,  setDesc]        = useState(existing?.description ?? '')
  const [isActive,     setIsActive]    = useState(existing?.is_active ?? true)
  const [sortOrder,    setSortOrder]   = useState<number | ''>(existing?.sort_order ?? '')

  const [saving,   setSaving]  = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]   = useState<string | null>(null)

  // Auto-generate slug from name
  function handleNameChange(v: string) {
    setName(v)
    if (isNew) {
      setSlug(v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const body = {
        id:           existing?.id,
        name,
        slug:         slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        icon,
        day_of_week:  dayOfWeek === '' ? null : Number(dayOfWeek),
        typical_time: typicalTime || null,
        description:  description || null,
        is_active:    isActive,
        sort_order:   sortOrder === '' ? null : Number(sortOrder),
      }
      const res = await fetch('/api/staff/event-type', {
        method:  isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save')
      router.push('/staff/events')
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
      const res = await fetch('/api/staff/event-type', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: existing.id }),
      })
      if (!res.ok) throw new Error('Delete failed')
      router.push('/staff/events')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setDeleting(false)
    }
  }

  const inputCls = "w-full border border-[#D4CFC3] rounded-xl px-3 py-2.5 text-sm text-[#242622] bg-[#FFFFFF] focus:outline-none focus:border-[#96321F] transition-colors"
  const labelCls = "block text-xs font-semibold text-[#7E613F] uppercase tracking-wide mb-1.5"

  return (
    <form onSubmit={handleSave} className="space-y-5">

      {/* Name + Icon row */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelCls}>Event Name</label>
          <input
            required
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="e.g. Cribbage League"
            className={inputCls}
          />
        </div>
        <div className="w-24">
          <label className={labelCls}>Emoji</label>
          <input
            value={icon}
            onChange={e => setIcon(e.target.value)}
            placeholder="📅"
            className={inputCls + " text-center text-xl"}
            maxLength={4}
          />
        </div>
      </div>

      {/* Slug */}
      <div>
        <label className={labelCls}>Slug (URL)</label>
        <input
          value={slug}
          onChange={e => setSlug(e.target.value)}
          placeholder="cribbage-league"
          className={inputCls + " font-mono text-xs"}
        />
        <p className="text-[10px] text-[#9E8F7E] mt-1">Used in leaderboard URL — no spaces, lowercase</p>
      </div>

      {/* Day of week + Time row */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelCls}>Day of Week</label>
          <select
            value={dayOfWeek}
            onChange={e => setDayOfWeek(e.target.value === '' ? '' : Number(e.target.value))}
            className={inputCls}
          >
            <option value="">— Select day —</option>
            {DAYS.map((d, i) => (
              <option key={i} value={i}>{d}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className={labelCls}>Typical Time</label>
          <input
            value={typicalTime}
            onChange={e => setTypicalTime(e.target.value)}
            placeholder="7:00 PM"
            className={inputCls}
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className={labelCls}>Description</label>
        <textarea
          rows={3}
          value={description}
          onChange={e => setDesc(e.target.value)}
          placeholder="Brief description shown on the Events tab…"
          className={inputCls + " resize-none"}
        />
      </div>

      {/* Sort order + Active row */}
      <div className="flex gap-3 items-end">
        <div className="w-28">
          <label className={labelCls}>Sort Order</label>
          <input
            type="number"
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="1"
            min={0}
            className={inputCls}
          />
        </div>
        <div className="flex-1 pb-0.5">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setIsActive(!isActive)}
              className={`relative w-11 h-6 rounded-full transition-colors ${isActive ? 'bg-[#87A67F]' : 'bg-[#D4CFC3]'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isActive ? 'translate-x-5' : ''}`} />
            </div>
            <span className="text-sm text-[#242622] font-medium">
              {isActive ? 'Visible on Events tab' : 'Hidden from customers'}
            </span>
          </label>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-[#96321F] text-[#FFFFFF] font-bold py-3 rounded-xl hover:bg-[#ae3a24] disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : isNew ? 'Create Event' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/staff/events')}
          className="px-5 py-3 rounded-xl bg-[#EDE9DC] text-[#7E613F] font-semibold hover:bg-[#D4CFC3] transition-colors text-sm"
        >
          Cancel
        </button>
      </div>

      {/* Delete */}
      {!isNew && (
        <div className="pt-2 border-t border-[#D4CFC3]">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm text-red-600 hover:text-red-700 font-semibold disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : '🗑 Delete this event'}
          </button>
        </div>
      )}
    </form>
  )
}
