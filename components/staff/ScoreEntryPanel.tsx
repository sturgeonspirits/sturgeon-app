'use client'

import { useState, useEffect, useCallback } from 'react'
import type { EventType, LeaderboardPeriod } from '@/lib/supabase/types'
import CribbageScoreForm from './CribbageScoreForm'
import TriviaIndividualForm from './TriviaIndividualForm'
import TriviaTeamForm from './TriviaTeamForm'
import { dayOfWeekLabel } from '@/lib/utils'

interface ScheduledEvent {
  id: string
  event_type_id: string
  event_date: string      // 'YYYY-MM-DD'
  start_time: string | null
  notes: string | null
}

// leaderboard_periods now has event_id linking it to a specific scheduled event
interface Period extends LeaderboardPeriod {
  event_id?: string | null
}

interface Props {
  eventTypes:      EventType[]
  openPeriods:     Period[]
  members:         { id: string; display_name: string | null; full_name: string | null; phone: string | null; email: string | null }[]
  staffId:         string
  scheduledEvents: ScheduledEvent[]
}

function fmtDate(dateStr: string, timeStr?: string | null) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const datePart = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  if (!timeStr) return datePart
  const [h, m] = timeStr.split(':').map(Number)
  const t = new Date(year, month - 1, day, h, m)
  const timePart = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${datePart} · ${timePart}`
}

function isToday(dateStr: string) {
  return dateStr === new Date().toLocaleDateString('en-CA')
}

function isPast(dateStr: string) {
  return dateStr < new Date().toLocaleDateString('en-CA')
}

export default function ScoreEntryPanel({ eventTypes, openPeriods, members, staffId, scheduledEvents }: Props) {
  const [selectedEventTypeId, setSelectedEventTypeId] = useState<string | null>(null)
  const [selectedPeriodId,    setSelectedPeriodId]    = useState<string | null>(null)
  const [periodError,         setPeriodError]         = useState('')
  const [showDateForm,        setShowDateForm]        = useState(false)
  const [quickDate,           setQuickDate]           = useState('')
  const [quickTime,           setQuickTime]           = useState('')
  const [quickSaving,         setQuickSaving]         = useState(false)

  const selectedET     = eventTypes.find(et => et.id === selectedEventTypeId)
  const selectedPeriod = openPeriods.find(p => p.id === selectedPeriodId) ?? null

  // All open periods for the selected event type
  const periodsForET = selectedEventTypeId
    ? openPeriods.filter(p => p.event_type_id === selectedEventTypeId)
    : []

  // Scheduled events for the selected event type — past 30 days through 14 days out
  const eventsForET = selectedEventTypeId
    ? scheduledEvents
        .filter(e => e.event_type_id === selectedEventTypeId)
        .sort((a, b) => b.event_date.localeCompare(a.event_date)) // newest first
    : []

  // Build combined date list: scheduled events merged with any periods not yet tied to an event
  // Each entry is either: { type:'event', event, period|null } or { type:'orphan', period }
  type DateEntry =
    | { type: 'event';  event: ScheduledEvent; period: Period | null }
    | { type: 'orphan'; period: Period }

  const eventIds = new Set(eventsForET.map(e => e.id))
  const orphanPeriods = periodsForET.filter(p => !p.event_id || !eventIds.has(p.event_id))

  const dateEntries: DateEntry[] = [
    ...eventsForET.map(ev => ({
      type: 'event' as const,
      event: ev,
      period: periodsForET.find(p => p.event_id === ev.id) ?? null,
    })),
    ...orphanPeriods.map(p => ({ type: 'orphan' as const, period: p })),
  ]

  async function createPeriodForEvent(ev: ScheduledEvent) {
    setPeriodError('')
    const [year, month, day] = ev.event_date.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    const label = d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })
    const res = await fetch('/api/staff/period', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventTypeId: ev.event_type_id,
        eventId:     ev.id,
        label,
        periodType:  'single_night',
        startsAt:    new Date().toISOString(),
      }),
    })
    if (res.ok) {
      window.location.reload()
    } else {
      const json = await res.json().catch(() => ({}))
      setPeriodError(json.error ?? `Server error ${res.status}`)
    }
  }

  async function scheduleAndStart(eventTypeId: string) {
    if (!quickDate) return
    setQuickSaving(true)
    setPeriodError('')
    // Creating the event also auto-creates the leaderboard period
    const evRes = await fetch('/api/staff/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventTypeId, eventDate: quickDate, startTime: quickTime || null }),
    })
    if (evRes.ok) {
      window.location.reload()
    } else {
      const j = await evRes.json().catch(() => ({}))
      setPeriodError(j.error ?? 'Failed to schedule event')
      setQuickSaving(false)
    }
  }

  function handleSelectET(id: string) {
    if (selectedEventTypeId === id) {
      setSelectedEventTypeId(null)
      setSelectedPeriodId(null)
    } else {
      setSelectedEventTypeId(id)
      setSelectedPeriodId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Event type picker */}
      <div className="grid gap-3">
        {eventTypes.map(et => {
          const periodCount  = openPeriods.filter(p => p.event_type_id === et.id).length
          const isSelected   = selectedEventTypeId === et.id
          return (
            <button
              key={et.id}
              onClick={() => handleSelectET(et.id)}
              className={`w-full text-left bg-[#FFFFFF] border rounded-xl p-4 transition-all ${
                isSelected ? 'border-[#96321F]' : 'border-[#D4CFC3] hover:border-[#C8BCA4]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{et.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-[#242622]">{et.name}</p>
                  <p className="text-xs text-[#7E613F]">
                    {et.day_of_week != null ? dayOfWeekLabel(et.day_of_week) : ''} · {et.participant_type} · {et.scoring_method.replace('_', '/')}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  periodCount > 0 ? 'bg-[#87A67F]/15 text-[#87A67F]' : 'bg-[#EDE9DC] text-[#7E613F]'
                }`}>
                  {periodCount > 0 ? `${periodCount} date${periodCount > 1 ? 's' : ''}` : 'No periods'}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Date list for selected event type */}
      {selectedET && !selectedPeriod && (
        <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-[#242622]">{selectedET.name} — Select a date</h3>

          {dateEntries.length === 0 ? (
            <p className="text-sm text-[#7E613F]">
              No scheduled dates found.{' '}
              <a href="/staff/events" className="text-[#96321F] underline underline-offset-2">
                Schedule a date
              </a>{' '}
              on the Events page, or start a generic period below.
            </p>
          ) : (
            <div className="space-y-2">
              {dateEntries.map(entry => {
                if (entry.type === 'event') {
                  const { event, period } = entry
                  const today   = isToday(event.event_date)
                  const past    = isPast(event.event_date)
                  return (
                    <div
                      key={event.id}
                      className={`border rounded-xl px-4 py-3 transition-all ${
                        today ? 'border-[#96321F]/30 bg-[#96321F]/5' : 'border-[#D4CFC3] bg-[#FAFAF7]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <svg className={today ? 'text-[#96321F]' : 'text-[#7E613F]'} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                          <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${today ? 'text-[#96321F]' : 'text-[#242622]'}`}>
                            {fmtDate(event.event_date, event.start_time)}
                            {today && <span className="ml-2 text-xs font-bold bg-[#96321F] text-white px-1.5 py-0.5 rounded-full">Tonight</span>}
                            {past && !today && <span className="ml-2 text-xs text-[#9E8F7E]">past</span>}
                          </p>
                          {event.notes && <p className="text-xs text-[#9E8F7E]">{event.notes}</p>}
                        </div>
                        {period ? (
                          <button
                            onClick={() => setSelectedPeriodId(period.id)}
                            className="text-xs font-bold text-[#87A67F] bg-[#87A67F]/10 px-3 py-1.5 rounded-lg hover:bg-[#87A67F]/20 transition-colors"
                          >
                            Enter scores →
                          </button>
                        ) : (
                          <button
                            onClick={() => createPeriodForEvent(event)}
                            className="text-xs font-bold text-[#96321F] bg-[#96321F]/8 px-3 py-1.5 rounded-lg hover:bg-[#96321F]/15 transition-colors"
                          >
                            Start →
                          </button>
                        )}
                      </div>
                    </div>
                  )
                }

                // Orphan period (no linked event — generic weekly etc.)
                const { period } = entry
                return (
                  <div key={period.id} className="border border-[#D4CFC3] bg-[#FAFAF7] rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="text-[#7E613F]">📋</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#242622]">{period.label}</p>
                      <p className="text-xs text-[#9E8F7E]">Generic period</p>
                    </div>
                    <button
                      onClick={() => setSelectedPeriodId(period.id)}
                      className="text-xs font-bold text-[#87A67F] bg-[#87A67F]/10 px-3 py-1.5 rounded-lg hover:bg-[#87A67F]/20 transition-colors"
                    >
                      Enter scores →
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Quick schedule + start */}
          <div className="pt-2 border-t border-[#F1F1E7] space-y-2">
            {!showDateForm ? (
              <button
                onClick={() => setShowDateForm(true)}
                className="text-xs font-semibold text-[#96321F] hover:underline"
              >
                + Schedule a specific date and start
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={quickDate}
                  onChange={e => setQuickDate(e.target.value)}
                  className="border border-[#D4CFC3] rounded-lg px-2 py-1.5 text-xs text-[#242622] focus:outline-none focus:border-[#96321F]"
                />
                <input
                  type="time"
                  value={quickTime}
                  onChange={e => setQuickTime(e.target.value)}
                  className="border border-[#D4CFC3] rounded-lg px-2 py-1.5 text-xs text-[#242622] focus:outline-none focus:border-[#96321F] w-28"
                />
                <button
                  onClick={() => scheduleAndStart(selectedET.id)}
                  disabled={!quickDate || quickSaving}
                  className="text-xs bg-[#96321F] text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-[#ae3a24] disabled:opacity-40 transition-colors"
                >
                  {quickSaving ? '…' : 'Start →'}
                </button>
                <button
                  onClick={() => { setShowDateForm(false); setQuickDate(''); setQuickTime('') }}
                  className="text-xs text-[#9E8F7E] hover:text-[#7E613F]"
                >
                  Cancel
                </button>
              </div>
            )}
            {/* Generic periods are intentionally removed — all periods must be tied to a
                specific event date. Schedule the event first via this panel or the Events page. */}
          </div>

          {periodError && <p className="text-xs text-red-500 mt-1">⚠️ {periodError}</p>}
        </div>
      )}

      {/* Score entry for selected period */}
      {selectedET && selectedPeriod && (
        <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[#242622]">{selectedET.name}</h3>
              <p className="text-xs text-[#7E613F] mt-0.5">📅 {selectedPeriod.label}</p>
            </div>
            <button
              onClick={() => setSelectedPeriodId(null)}
              className="text-xs text-[#9E8F7E] hover:text-[#7E613F] transition-colors px-2 py-1 rounded-lg hover:bg-[#F1F1E7]"
            >
              ← All dates
            </button>
          </div>

          {/* Sign-ups — show for all events so staff can see and remove no-shows */}
          <SignupsPanel periodId={selectedPeriod.id} />

          {/* QR join code — trivia team events only */}
          {selectedET.participant_type === 'team' && (selectedPeriod as any).join_token && (
            <JoinQRBlock token={(selectedPeriod as any).join_token} />
          )}

          {selectedET.scoring_method === 'wins_losses' && (
            <CribbageScoreForm period={selectedPeriod} members={members} staffId={staffId} />
          )}
          {selectedET.scoring_method === 'points' && selectedET.participant_type === 'individual' && (
            <TriviaIndividualForm period={selectedPeriod} members={members} staffId={staffId} />
          )}
          {selectedET.scoring_method === 'points' && selectedET.participant_type === 'team' && (
            <TriviaTeamForm period={selectedPeriod} members={members} staffId={staffId} eventTypeId={selectedET.id} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Signups panel ─────────────────────────────────────────────────────────────

interface SignupMember { userId: string; name: string }
interface SignupTeam   { teamId: string; name: string; members: SignupMember[] }

function SignupsPanel({ periodId }: { periodId: string }) {
  const [teams,       setTeams]       = useState<SignupTeam[]>([])
  const [individuals, setIndividuals] = useState<SignupMember[]>([])
  const [loading,     setLoading]     = useState(true)
  const [removing,    setRemoving]    = useState<string | null>(null)
  const [error,       setError]       = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/staff/period-signups?periodId=${periodId}`)
    const json = await res.json()
    setTeams(json.teams ?? [])
    setIndividuals(json.individuals ?? [])
    setLoading(false)
  }, [periodId])

  useEffect(() => { load() }, [load])

  async function handleRemove(userId: string) {
    setRemoving(userId)
    setError('')
    const res = await fetch('/api/staff/remove-signup', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodId, userId }),
    })
    setRemoving(null)
    if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Could not remove'); return }
    await load()
  }

  const totalCount = teams.reduce((n, t) => n + t.members.length, 0) + individuals.length
  const hasSignups = teams.length > 0 || individuals.length > 0

  return (
    <div className="bg-[#F7F5EF] border border-[#D4CFC3] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-[#7E613F] uppercase tracking-widest">
          Sign-ups {totalCount > 0 ? `· ${totalCount}` : ''}
        </p>
        <button onClick={load} className="text-xs text-[#9E8F7E] hover:text-[#7E613F] transition-colors">↻ Refresh</button>
      </div>

      {loading && <p className="text-xs text-[#9E8F7E]">Loading…</p>}

      {!loading && !hasSignups && (
        <p className="text-xs text-[#9E8F7E]">No sign-ups yet.</p>
      )}

      {/* Team sign-ups */}
      {!loading && teams.map(team => (
        <div key={team.teamId} className="space-y-1">
          <p className="text-xs font-semibold text-[#242622]">{team.name}</p>
          {team.members.map(m => (
            <div key={m.userId} className="flex items-center justify-between bg-white border border-[#E8E4DB] rounded-lg px-3 py-2">
              <span className="text-sm text-[#242622]">{m.name}</span>
              <button
                onClick={() => handleRemove(m.userId)}
                disabled={removing === m.userId}
                className="text-xs text-[#96321F] hover:text-[#ae3a24] font-medium disabled:opacity-40 transition-colors"
              >
                {removing === m.userId ? '…' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      ))}

      {/* Individual sign-ups */}
      {!loading && individuals.length > 0 && (
        <div className="space-y-1">
          {teams.length > 0 && <p className="text-xs font-semibold text-[#242622]">Individual</p>}
          {individuals.map(m => (
            <div key={m.userId} className="flex items-center justify-between bg-white border border-[#E8E4DB] rounded-lg px-3 py-2">
              <span className="text-sm text-[#242622]">{m.name}</span>
              <button
                onClick={() => handleRemove(m.userId)}
                disabled={removing === m.userId}
                className="text-xs text-[#96321F] hover:text-[#ae3a24] font-medium disabled:opacity-40 transition-colors"
              >
                {removing === m.userId ? '…' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function JoinQRBlock({ token }: { token: string }) {
  const origin  = typeof window !== 'undefined' ? window.location.origin : 'https://app.sturgeonspirits.com'
  const joinUrl = `${origin}/join?t=${token}`
  const qrSrc   = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}&format=png`

  return (
    <div className="bg-[#F7F5EF] border border-[#D4CFC3] rounded-xl p-4 flex flex-col items-center gap-3">
      <p className="text-xs font-semibold text-[#7E613F] uppercase tracking-wide">📱 Players scan to join a team</p>
      <img src={qrSrc} alt="Join QR code" width={200} height={200} className="rounded-xl" />
      <div className="flex gap-2 w-full items-center">
        <p className="flex-1 text-xs text-[#9E8F7E] truncate">{joinUrl}</p>
        <button
          onClick={() => navigator.clipboard.writeText(joinUrl)}
          className="text-xs text-[#96321F] font-semibold hover:underline shrink-0"
        >
          Copy
        </button>
      </div>
    </div>
  )
}
