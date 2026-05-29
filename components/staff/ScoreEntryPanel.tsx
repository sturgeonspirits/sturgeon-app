'use client'

import { useState, useEffect, useCallback } from 'react'
import type { EventType, LeaderboardPeriod } from '@/lib/supabase/types'
import CribbageScoreForm from './CribbageScoreForm'
import TriviaIndividualForm from './TriviaIndividualForm'
import TriviaTeamForm from './TriviaTeamForm'
import { dayOfWeekLabel } from '@/lib/utils'

interface ScheduledEvent {
  id: string
  event_type_id: string | null
  event_date: string      // 'YYYY-MM-DD'
  start_time: string | null
  notes: string | null
}

// leaderboard_periods has event_id linking it to a specific scheduled event (in base type)
type Period = LeaderboardPeriod

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
  // The scheduled event ID (events table) for the selected date — used so
  // SignupsPanel can look up registrations across ALL periods for that event.
  const [selectedEventId,     setSelectedEventId]     = useState<string | null>(null)
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
      setSelectedEventId(null)
    } else {
      setSelectedEventTypeId(id)
      setSelectedPeriodId(null)
      setSelectedEventId(null)
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
                            onClick={() => { setSelectedPeriodId(period.id); setSelectedEventId(event.id) }}
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

                // Orphan period (no linked event — created before auto-linking was added)
                const { period } = entry
                return (
                  <div key={period.id} className="border border-[#D4CFC3] bg-[#FAFAF7] rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="text-[#7E613F]">📋</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#242622]">{period.label}</p>
                      <p className="text-xs text-[#9E8F7E]">Unlinked period</p>
                    </div>
                    <button
                      onClick={() => { setSelectedPeriodId(period.id); setSelectedEventId((period as any).event_id ?? null) }}
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
              onClick={() => { setSelectedPeriodId(null); setSelectedEventId(null) }}
              className="text-xs text-[#9E8F7E] hover:text-[#7E613F] transition-colors px-2 py-1 rounded-lg hover:bg-[#F1F1E7]"
            >
              ← All dates
            </button>
          </div>

          {/* Sign-ups — pass eventId so panel catches registrations on any linked period */}
          <SignupsPanel
            periodId={selectedPeriod.id}
            eventId={selectedEventId ?? undefined}
            scoringMethod={selectedET.scoring_method}
            participantType={selectedET.participant_type}
            staffId={staffId}
          />

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
            <TriviaTeamForm period={selectedPeriod} members={members} staffId={staffId} eventTypeId={selectedET.id} eventId={selectedEventId} />
          )}

          {/* Finalize night — awards placement bonuses for individual events */}
          {selectedET.participant_type === 'individual' && (
            <FinalizeNightButton periodId={selectedPeriod.id} isFinalized={selectedPeriod.is_finalized ?? false} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Signups panel ─────────────────────────────────────────────────────────────

interface SignupMember { userId: string; name: string }
interface SignupTeam   { teamId: string; name: string; members: SignupMember[] }
interface SignupIndividual {
  userId: string
  name: string
  wins: number
  losses: number
  spread: number
  score: number
  hasScores: boolean
  enteredAt: string | null
}

function SignupsPanel({
  periodId, eventId, scoringMethod, participantType, staffId,
}: {
  periodId: string
  eventId?: string
  scoringMethod: string
  participantType: string
  staffId: string
}) {
  const [teams,       setTeams]       = useState<SignupTeam[]>([])
  const [individuals, setIndividuals] = useState<SignupIndividual[]>([])
  const [loading,     setLoading]     = useState(true)
  const [removing,    setRemoving]    = useState<string | null>(null)
  const [error,       setError]       = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    // Always include periodId; also include eventId when available so the API
    // can aggregate sign-ups across ALL periods linked to this event.
    const params = new URLSearchParams({ periodId })
    if (eventId) params.set('eventId', eventId)
    const res  = await fetch(`/api/staff/period-signups?${params}`)
    const json = await res.json()
    setTeams(json.teams ?? [])
    setIndividuals(json.individuals ?? [])
    setLoading(false)
  }, [periodId, eventId])

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
  const scoredCount = individuals.filter(i => i.hasScores).length
  const isCribbage = scoringMethod === 'wins_losses' && participantType === 'individual'

  return (
    <div className="bg-[#F7F5EF] border border-[#D4CFC3] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-[#7E613F] uppercase tracking-widest">
          Sign-ups {totalCount > 0 ? `· ${totalCount}` : ''}
          {isCribbage && individuals.length > 0 && (
            <span className="ml-2 text-[#87A67F] normal-case tracking-normal">
              ({scoredCount}/{individuals.length} scored)
            </span>
          )}
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
            isCribbage ? (
              <CribbageInlineRow
                key={m.userId}
                row={m}
                periodId={periodId}
                staffId={staffId}
                onSaved={load}
                onRemove={() => handleRemove(m.userId)}
                removing={removing === m.userId}
              />
            ) : (
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
            )
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// Inline score entry row for cribbage sign-ups.
// Staff can enter wins/spread directly, see current score state, and edit.
// Uses replaceMode so re-submits don't double points.
function CribbageInlineRow({
  row, periodId, staffId, onSaved, onRemove, removing,
}: {
  row: SignupIndividual
  periodId: string
  staffId: string
  onSaved: () => void
  onRemove: () => void
  removing: boolean
}) {
  const [editing, setEditing] = useState(!row.hasScores)
  const [wins,    setWins]    = useState<string>(row.hasScores ? String(row.wins) : '')
  const [spread,  setSpread]  = useState<string>(row.hasScores ? String(row.spread) : '')
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState('')

  async function save() {
    if (wins === '') return
    setSaving(true)
    setErr('')
    const winsN   = Math.max(0, Math.min(3, parseInt(wins) || 0))
    const spreadN = parseInt(spread) || 0
    const res = await fetch('/api/staff/leaderboard-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        periodId,
        scoringMethod: 'wins_losses',
        staffId,
        replaceMode: true,
        entries: [{ userId: row.userId, wins: winsN, losses: 3 - winsN, spread: spreadN }],
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setErr(j.error ?? 'Save failed')
      return
    }
    setEditing(false)
    onSaved()
  }

  // Read-only display for already-scored rows
  if (!editing) {
    const spreadCol = row.spread >= 0 ? 'text-[#87A67F]' : 'text-red-500'
    return (
      <div className="bg-white border border-[#87A67F]/30 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs">✓</span>
          <span className="text-sm text-[#242622] flex-1 truncate">{row.name}</span>
          <span className="text-sm font-bold text-[#242622]">{row.wins}W – {row.losses}L</span>
          <span className={`text-xs font-mono ${spreadCol}`}>
            {row.spread >= 0 ? '+' : ''}{row.spread}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-[#96321F] hover:underline ml-1"
          >
            Edit
          </button>
        </div>
      </div>
    )
  }

  // Edit / first-entry form
  return (
    <div className="bg-white border border-[#E8E4DB] rounded-lg px-3 py-2 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-[#242622] flex-1 truncate">{row.name}</span>
        <button
          onClick={onRemove}
          disabled={removing || saving}
          className="text-xs text-[#9E8F7E] hover:text-red-500 font-medium disabled:opacity-40 transition-colors"
        >
          {removing ? '…' : 'Remove'}
        </button>
      </div>
      <div className="flex items-center gap-2">
        {/* Wins 0-3 buttons */}
        <div className="flex gap-1 flex-1">
          {[0, 1, 2, 3].map(n => (
            <button
              key={n}
              onClick={() => setWins(String(n))}
              disabled={saving}
              className={`flex-1 min-h-[38px] rounded-lg text-sm font-bold border transition-all active:scale-95 ${
                wins === String(n)
                  ? 'bg-[#96321F] text-white border-[#96321F]'
                  : 'bg-white text-[#7E613F] border-[#D4CFC3] hover:border-[#96321F]/50'
              }`}
            >
              {n}W
            </button>
          ))}
        </div>
        {/* Spread */}
        <input
          type="number"
          value={spread}
          onChange={e => setSpread(e.target.value)}
          placeholder="±0"
          disabled={saving}
          className="w-20 border border-[#C8BCA4] rounded-lg px-2 min-h-[38px] text-[#242622] text-sm focus:outline-none focus:border-[#96321F] text-center"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving || wins === ''}
          className="flex-1 bg-[#96321F] text-white text-xs font-semibold min-h-[36px] rounded-lg disabled:opacity-40 hover:bg-[#ae3a24] transition-colors"
        >
          {saving ? 'Saving…' : (row.hasScores ? 'Update' : 'Save scores')}
        </button>
        {row.hasScores && (
          <button
            onClick={() => {
              setEditing(false)
              setWins(String(row.wins))
              setSpread(String(row.spread))
              setErr('')
            }}
            disabled={saving}
            className="text-xs text-[#9E8F7E] hover:text-[#7E613F] px-3 min-h-[36px]"
          >
            Cancel
          </button>
        )}
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
    </div>
  )
}

function FinalizeNightButton({ periodId, isFinalized }: { periodId: string; isFinalized: boolean }) {
  const [saving,  setSaving]  = useState(false)
  const [result,  setResult]  = useState<{ name: string; place: number; bonus: number }[] | null>(null)
  const [error,   setError]   = useState('')
  const [done,    setDone]    = useState(isFinalized)

  async function finalize() {
    if (!confirm('Award placement bonuses for this night? This ranks all players and gives +50 to 1st, +30 to 2nd.')) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/staff/finalize-night', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodId }),
    })
    const json = await res.json()
    setSaving(false)
    if (res.ok) {
      setResult(json.placements ?? [])
      setDone(true)
    } else {
      setError(json.error ?? 'Failed to finalize')
    }
  }

  if (done && !result) {
    return (
      <div className="bg-[#87A67F]/10 border border-[#87A67F]/30 rounded-xl p-4 text-center">
        <p className="text-sm text-[#87A67F] font-semibold">✓ Night finalized — placement bonuses awarded</p>
      </div>
    )
  }

  return (
    <div className="bg-[#F7F5EF] border border-[#D4CFC3] rounded-xl p-4 space-y-3">
      <p className="text-xs font-bold text-[#7E613F] uppercase tracking-widest">Finalize Night</p>
      <p className="text-xs text-[#9E8F7E]">
        After all scores are entered, finalize to award placement bonuses: 1st gets +50 pts, 2nd gets +30 pts.
      </p>

      {result ? (
        <div className="space-y-1">
          {result.map((r, i) => (
            <div key={i} className="flex items-center gap-2 bg-white border border-[#E8E4DB] rounded-lg px-3 py-2">
              <span className="text-lg">{r.place === 1 ? '🥇' : '🥈'}</span>
              <span className="text-sm font-semibold text-[#242622] flex-1">{r.name}</span>
              <span className="text-sm font-bold text-[#87A67F]">+{r.bonus} pts</span>
            </div>
          ))}
          <p className="text-xs text-[#87A67F] font-medium mt-2">✓ Bonuses awarded</p>
        </div>
      ) : (
        <button
          onClick={finalize}
          disabled={saving}
          className="w-full bg-[#87A67F] text-white font-semibold py-3 rounded-xl disabled:opacity-40 hover:bg-[#769968] active:scale-[0.98] transition-all text-sm"
        >
          {saving ? 'Finalizing…' : '🏆 Finalize & Award Bonuses'}
        </button>
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
