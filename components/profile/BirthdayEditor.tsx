'use client'

import { useState } from 'react'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function daysInMonth(month: number) {
  // Use a leap year (2024) so February gives 29
  return new Date(2024, month, 0).getDate()
}

function formatDisplay(val: string | null): string | null {
  if (!val) return null
  const [mm, dd] = val.split('/')
  const m = MONTHS[Number(mm) - 1]
  return m ? `${m} ${Number(dd)}` : val
}

export default function BirthdayEditor({ current }: { current: string | null }) {
  const [editing,  setEditing]  = useState(false)
  const [month,    setMonth]    = useState(() => current?.split('/')[0] ?? '')
  const [day,      setDay]      = useState(() => current?.split('/')[1] ?? '')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [display,  setDisplay]  = useState(current)

  const maxDay = month ? daysInMonth(Number(month)) : 31

  async function save() {
    if (!month || !day) return
    setSaving(true)
    setError('')
    const val = `${month.padStart(2, '0')}/${day.padStart(2, '0')}`
    try {
      const res = await fetch('/api/profile/birthday', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ birthday: val }),
      })
      if (res.ok) {
        setDisplay(val)
        setEditing(false)
      } else {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? 'Failed to save — please try again.')
      }
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between py-3 border-b border-[#EDE9DC]">
        <div>
          <p className="text-xs text-[#7E613F]">Birthday</p>
          <p className="text-sm text-[#242622] mt-0.5">
            {formatDisplay(display) ?? (
              <span className="text-[#9E8F7E] italic">Not set — add yours for a free cocktail 🎂</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-[#96321F] font-semibold border border-[#96321F]/30 px-3 py-1.5 rounded-lg hover:bg-[#96321F]/5 transition-colors"
        >
          {display ? 'Edit' : 'Add'}
        </button>
      </div>
    )
  }

  return (
    <div className="py-3 border-b border-[#EDE9DC] space-y-3">
      <div>
        <p className="text-xs font-semibold text-[#7E613F]">Birthday</p>
        <p className="text-xs text-[#9E8F7E] mt-0.5">
          We'll send a free cocktail your way when you check in on your birthday 🎂
        </p>
      </div>

      <div className="flex gap-2">
        <select
          value={month}
          onChange={e => { setMonth(e.target.value); setDay('') }}
          className="flex-1 border border-[#D4CFC3] rounded-xl px-3 py-2 text-sm text-[#242622] bg-white focus:outline-none focus:border-[#96321F]"
        >
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>{m}</option>
          ))}
        </select>

        <select
          value={day}
          onChange={e => setDay(e.target.value)}
          disabled={!month}
          className="w-24 border border-[#D4CFC3] rounded-xl px-3 py-2 text-sm text-[#242622] bg-white focus:outline-none focus:border-[#96321F] disabled:opacity-50"
        >
          <option value="">Day</option>
          {Array.from({ length: maxDay }, (_, i) => i + 1).map(d => (
            <option key={d} value={String(d)}>{d}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={!month || !day || saving}
          className="flex-1 bg-[#96321F] text-white text-sm font-semibold py-2 rounded-xl disabled:opacity-50 hover:bg-[#ae3a24] transition-colors"
        >
          {saving ? 'Saving…' : 'Save Birthday'}
        </button>
        <button
          onClick={() => { setEditing(false); setError('') }}
          className="px-4 text-sm text-[#7E613F] border border-[#D4CFC3] rounded-xl hover:bg-[#EDE9DC] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
