'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ScheduledEvent {
  id: string
  event_date: string   // 'YYYY-MM-DD'
  start_time: string | null
  notes: string | null
  is_cancelled: boolean
}

interface Props {
  eventTypeId: string
  upcomingEvents: ScheduledEvent[]
}

const TZ = 'America/Chicago'

function fmtEventDate(dateStr: string, timeStr?: string | null) {
  // dateStr is 'YYYY-MM-DD', parse as local date
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const datePart = d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
  if (!timeStr) return datePart
  // timeStr is 'HH:MM' or 'HH:MM:SS'
  const [h, m] = timeStr.split(':').map(Number)
  const t = new Date(year, month - 1, day, h, m)
  const timePart = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${datePart} · ${timePart}`
}

export default function EventScheduleManager({ eventTypeId, upcomingEvents: initial }: Props) {
  const router = useRouter()
  const [events, setEvents]       = useState<ScheduledEvent[]>(initial)
  const [showForm, setShowForm]   = useState(false)
  const [date, setDate]           = useState('')
  const [time, setTime]           = useState('')
  const [notes, setNotes]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState<string | null>(null)

  async function scheduleDate() {
    if (!date) return
    setSaving(true)
    const res = await fetch('/api/staff/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventTypeId,
        eventDate: date,
        startTime: time || null,
        notes: notes || null,
      }),
    })
    const json = await res.json()
    if (res.ok && json.event) {
      setEvents(prev => [...prev, json.event].sort((a, b) => a.event_date.localeCompare(b.event_date)))
      setDate('')
      setTime('')
      setNotes('')
      setShowForm(false)
    }
    setSaving(false)
  }

  async function removeDate(id: string) {
    setDeleting(id)
    const res = await fetch(`/api/staff/event?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setEvents(prev => prev.filter(e => e.id !== id))
    }
    setDeleting(null)
  }

  // Today's date as YYYY-MM-DD for min constraint
  const today = new Date().toLocaleDateString('en-CA')

  return (
    <div className="mt-2 space-y-1.5">
      {events.length > 0 && (
        <div className="space-y-1">
          {events.map(ev => (
            <div
              key={ev.id}
              className="flex items-center gap-2 text-xs text-[#7E613F] pl-1"
            >
              <svg className="text-[#96321F] shrink-0" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span className="flex-1 font-medium text-[#242622]">
                {fmtEventDate(ev.event_date, ev.start_time)}
              </span>
              {ev.notes && (
                <span className="text-[#9E8F7E] truncate max-w-[100px]">{ev.notes}</span>
              )}
              <button
                onClick={() => removeDate(ev.id)}
                disabled={deleting === ev.id}
                className="text-[#C8BCA4] hover:text-red-400 transition-colors ml-1 font-bold leading-none disabled:opacity-40"
                aria-label="Remove date"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input
            type="date"
            value={date}
            min={today}
            onChange={e => setDate(e.target.value)}
            className="border border-[#D4CFC3] rounded-lg px-2 py-1.5 text-xs text-[#242622] focus:outline-none focus:border-[#96321F] transition-colors"
          />
          <input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            className="border border-[#D4CFC3] rounded-lg px-2 py-1.5 text-xs text-[#242622] focus:outline-none focus:border-[#96321F] transition-colors w-28"
          />
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="border border-[#D4CFC3] rounded-lg px-2 py-1.5 text-xs text-[#242622] placeholder-[#C8BCA4] focus:outline-none focus:border-[#96321F] transition-colors flex-1 min-w-24"
          />
          <button
            onClick={scheduleDate}
            disabled={!date || saving}
            className="text-xs bg-[#96321F] text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-[#ae3a24] disabled:opacity-40 transition-colors"
          >
            {saving ? '…' : 'Add'}
          </button>
          <button
            onClick={() => { setShowForm(false); setDate(''); setTime(''); setNotes('') }}
            className="text-xs text-[#9E8F7E] hover:text-[#7E613F] transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="text-xs text-[#7E613F] hover:text-[#96321F] font-medium transition-colors flex items-center gap-1 pt-0.5"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Schedule a date
        </button>
      )}
    </div>
  )
}
