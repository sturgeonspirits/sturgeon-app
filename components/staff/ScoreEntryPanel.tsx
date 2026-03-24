'use client'

import { useState } from 'react'
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

interface Props {
  eventTypes:      EventType[]
  openPeriods:     LeaderboardPeriod[]
  members:         { id: string; display_name: string | null; email: string | null }[]
  staffId:         string
  scheduledEvents: ScheduledEvent[]
}

function fmtEventDate(dateStr: string, timeStr?: string | null) {
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
  const today = new Date().toLocaleDateString('en-CA')
  return dateStr === today
}

export default function ScoreEntryPanel({ eventTypes, openPeriods, members, staffId, scheduledEvents }: Props) {
  const [selectedEventTypeId, setSelectedEventTypeId] = useState<string | null>(null)
  const [periodError, setPeriodError] = useState('')

  const selectedET   = eventTypes.find(et => et.id === selectedEventTypeId)
  const activePeriod = openPeriods.find(p => p.event_type_id === selectedEventTypeId)

  // Scheduled events for the selected event type, sorted soonest first
  const upcomingForSelected = selectedEventTypeId
    ? scheduledEvents
        .filter(e => e.event_type_id === selectedEventTypeId)
        .sort((a, b) => a.event_date.localeCompare(b.event_date))
    : []

  async function createPeriodForDate(eventTypeId: string, eventDate: string, startTime: string | null) {
    setPeriodError('')
    const [year, month, day] = eventDate.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    const label = d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })
    const now = new Date()
    const res = await fetch('/api/staff/period', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventTypeId,
        label,
        periodType: 'single_night',
        startsAt: now.toISOString(),
      }),
    })
    if (res.ok) {
      window.location.reload()
    } else {
      const json = await res.json().catch(() => ({}))
      setPeriodError(json.error ?? `Server error ${res.status}`)
    }
  }

  async function createGenericPeriod(eventTypeId: string) {
    setPeriodError('')
    const now   = new Date()
    const label = `Week of ${now.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}`
    const res   = await fetch('/api/staff/period', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventTypeId, label, periodType: 'weekly', startsAt: now.toISOString() }),
    })
    if (res.ok) {
      window.location.reload()
    } else {
      const json = await res.json().catch(() => ({}))
      setPeriodError(json.error ?? `Server error ${res.status}`)
    }
  }

  return (
    <div className="space-y-4">
      {/* Event type picker */}
      <div className="grid gap-3">
        {eventTypes.map(et => {
          const hasPeriod  = openPeriods.some(p => p.event_type_id === et.id)
          const isSelected = selectedEventTypeId === et.id
          // Show a dot badge if there are upcoming scheduled dates
          const hasScheduled = scheduledEvents.some(e => e.event_type_id === et.id)
          return (
            <button
              key={et.id}
              onClick={() => setSelectedEventTypeId(isSelected ? null : et.id)}
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
                  hasPeriod ? 'bg-[#87A67F]/15 text-[#87A67F]' : 'bg-[#EDE9DC] text-[#7E613F]'
                }`}>
                  {hasPeriod ? 'Active' : 'No period'}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Score entry for selected event */}
      {selectedET && (
        <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[#242622]">{selectedET.name}</h3>
          </div>

          {!activePeriod ? (
            <div className="space-y-3">
              {/* Scheduled event dates — primary options */}
              {upcomingForSelected.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#7E613F] uppercase tracking-wide">
                    Start scoring for a scheduled date
                  </p>
                  {upcomingForSelected.map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => createPeriodForDate(selectedET.id, ev.event_date, ev.start_time)}
                      className={`w-full text-left border rounded-xl px-4 py-3 flex items-center gap-3 transition-all hover:border-[#96321F]/40 ${
                        isToday(ev.event_date)
                          ? 'border-[#96321F]/30 bg-[#96321F]/5'
                          : 'border-[#D4CFC3] bg-[#FAFAF7]'
                      }`}
                    >
                      <svg className={isToday(ev.event_date) ? 'text-[#96321F]' : 'text-[#7E613F]'} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${isToday(ev.event_date) ? 'text-[#96321F]' : 'text-[#242622]'}`}>
                          {fmtEventDate(ev.event_date, ev.start_time)}
                          {isToday(ev.event_date) && (
                            <span className="ml-2 text-xs font-bold bg-[#96321F] text-white px-1.5 py-0.5 rounded-full">Tonight</span>
                          )}
                        </p>
                        {ev.notes && (
                          <p className="text-xs text-[#9E8F7E]">{ev.notes}</p>
                        )}
                      </div>
                      <span className="text-xs font-bold text-[#96321F]">Start →</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#7E613F]">
                  No scheduled dates found.{' '}
                  <a href="/staff/events" className="text-[#96321F] underline underline-offset-2">
                    Schedule a date
                  </a>{' '}
                  on the Events page, or start a generic period below.
                </p>
              )}

              {/* Generic period fallback */}
              <div className="pt-1 border-t border-[#F1F1E7]">
                <button
                  onClick={() => createGenericPeriod(selectedET.id)}
                  className="text-xs text-[#9E8F7E] hover:text-[#7E613F] transition-colors"
                >
                  + Start generic weekly period instead
                </button>
              </div>

              {periodError && (
                <p className="text-xs text-red-500 mt-1">⚠️ {periodError}</p>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs text-[#7E613F]">Period: {activePeriod.label}</p>

              {/* Branch on scoring method — driven by DB config */}
              {selectedET.scoring_method === 'wins_losses' && (
                <CribbageScoreForm period={activePeriod} members={members} staffId={staffId} />
              )}
              {selectedET.scoring_method === 'points' && selectedET.participant_type === 'individual' && (
                <TriviaIndividualForm period={activePeriod} members={members} staffId={staffId} />
              )}
              {selectedET.participant_type === 'team' && (
                <TriviaTeamForm period={activePeriod} members={members} staffId={staffId} eventTypeId={selectedET.id} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
