'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const PARTICIPANT_TYPES = [
  { value: 'individual', label: 'Individual',        desc: 'Each player competes on their own' },
  { value: 'team',       label: 'Teams',             desc: 'Players form teams each session'   },
  { value: 'both',       label: 'Both',              desc: 'Has both individual and team boards' },
]

const SCORING_METHODS = [
  { value: 'wins_losses', label: 'Wins / Losses',   desc: 'Cribbage-style — track W/L record' },
  { value: 'points',      label: 'Points',           desc: 'Trivia-style — raw score total'    },
  { value: 'placement',   label: 'Placement',        desc: 'Ranked finish (1st, 2nd, 3rd…)'   },
  { value: 'time',        label: 'Time',             desc: 'Fastest time wins'                 },
]

interface EventType {
  id: string
  name: string
  slug: string | null
  icon: string | null
  day_of_week: number | null
  typical_time: string | null
  schedule_label: string | null
  description: string | null
  participant_type: string | null
  scoring_method: string | null
  is_active: boolean | null
  sort_order: number | null
}

interface Props {
  existing: EventType | null
}

export default function EventTypeForm({ existing }: Props) {
  const router = useRouter()
  const isNew = !existing

  const [name,            setName]           = useState(existing?.name ?? '')
  const [slug,            setSlug]           = useState(existing?.slug ?? '')
  const [icon,            setIcon]           = useState(existing?.icon ?? '📅')
  const [dayOfWeek,       setDayOfWeek]      = useState<number | ''>(existing?.day_of_week ?? '')
  const [typicalTime,     setTypicalTime]    = useState(existing?.typical_time ?? '')
  const [scheduleLabel,   setScheduleLabel]  = useState(existing?.schedule_label ?? '')
  const [description,     setDesc]           = useState(existing?.description ?? '')
  const [participantType, setParticipantType] = useState(existing?.participant_type ?? 'individual')
  const [scoringMethod,   setScoringMethod]  = useState(existing?.scoring_method ?? 'points')
  const [isActive,        setIsActive]       = useState(existing?.is_active ?? true)
  const [sortOrder,       setSortOrder]      = useState<number | ''>(existing?.sort_order ?? '')

  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

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
        id:               existing?.id,
        name,
        slug:             slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        icon,
        day_of_week:      dayOfWeek === '' ? null : Number(dayOfWeek),
        typical_time:     typicalTime || null,
        schedule_label:   scheduleLabel || null,
        description:      description || null,
        participant_type: participantType,
        scoring_method:   scoringMethod,
        is_active:        isActive,
        sort_order:       sortOrder === '' ? null : Number(sortOrder),
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

      {/* Name + Icon */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelCls}>Event Name</label>
          <input
            required
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="e.g. Trivia Night — Teams"
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
          placeholder="trivia-teams"
          className={inputCls + " font-mono text-xs"}
        />
        <p className="text-[10px] text-[#9E8F7E] mt-1">Used in leaderboard URL — lowercase, no spaces</p>
      </div>

      {/* Participant type */}
      <div>
        <label className={labelCls}>Players</label>
        <div className="grid grid-cols-3 gap-2">
          {PARTICIPANT_TYPES.map(pt => (
            <button
              key={pt.value}
              type="button"
              onClick={() => setParticipantType(pt.value)}
              className={`text-left p-3 rounded-xl border transition-colors ${
                participantType === pt.value
                  ? 'border-[#96321F] bg-[#96321F]/5'
                  : 'border-[#D4CFC3] bg-[#FFFFFF] hover:border-[#C8BCA4]'
              }`}
            >
              <p className={`text-xs font-semibold ${participantType === pt.value ? 'text-[#96321F]' : 'text-[#242622]'}`}>
                {pt.label}
              </p>
              <p className="text-[10px] text-[#9E8F7E] mt-0.5 leading-tight">{pt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Scoring method */}
      <div>
        <label className={labelCls}>Scoring</label>
        <div className="grid grid-cols-2 gap-2">
          {SCORING_METHODS.map(sm => (
            <button
              key={sm.value}
              type="button"
              onClick={() => setScoringMethod(sm.value)}
              className={`text-left p-3 rounded-xl border transition-colors ${
                scoringMethod === sm.value
                  ? 'border-[#96321F] bg-[#96321F]/5'
                  : 'border-[#D4CFC3] bg-[#FFFFFF] hover:border-[#C8BCA4]'
              }`}
            >
              <p className={`text-xs font-semibold ${scoringMethod === sm.value ? 'text-[#96321F]' : 'text-[#242622]'}`}>
                {sm.label}
              </p>
              <p className="text-[10px] text-[#9E8F7E] mt-0.5 leading-tight">{sm.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Day + Time */}
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

      {/* Schedule label override */}
      <div>
        <label className={labelCls}>Schedule Label <span className="normal-case font-normal text-[#9E8F7E]">(optional override)</span></label>
        <input
          value={scheduleLabel}
          onChange={e => setScheduleLabel(e.target.value)}
          placeholder="e.g. 1st & 3rd Wednesdays"
          className={inputCls}
        />
        <p className="text-[10px] text-[#9E8F7E] mt-1">If set, replaces the auto-generated day label everywhere it appears</p>
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

      {/* Sort order + Active */}
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

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
      )}

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
