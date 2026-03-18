'use client'

import { useState } from 'react'
import type { EventType, LeaderboardPeriod } from '@/lib/supabase/types'
import CribbageScoreForm from './CribbageScoreForm'
import TriviaIndividualForm from './TriviaIndividualForm'
import TriviaTeamForm from './TriviaTeamForm'
import { dayOfWeekLabel } from '@/lib/utils'

interface Props {
  eventTypes:  EventType[]
  openPeriods: LeaderboardPeriod[]
  members:     { id: string; display_name: string | null; email: string | null }[]
  staffId:     string
}

export default function ScoreEntryPanel({ eventTypes, openPeriods, members, staffId }: Props) {
  const [selectedEventTypeId, setSelectedEventTypeId] = useState<string | null>(null)

  const selectedET = eventTypes.find(et => et.id === selectedEventTypeId)
  const activePeriod = openPeriods.find(p => p.event_type_id === selectedEventTypeId)

  async function createPeriod(eventTypeId: string) {
    const now   = new Date()
    const label = `Week of ${now.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}`
    const res   = await fetch('/api/staff/period', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventTypeId, label, periodType: 'weekly', startsAt: now.toISOString() }),
    })
    if (res.ok) window.location.reload()
  }

  return (
    <div className="space-y-4">
      {/* Event type picker */}
      <div className="grid gap-3">
        {eventTypes.map(et => {
          const hasPeriod = openPeriods.some(p => p.event_type_id === et.id)
          const isSelected = selectedEventTypeId === et.id
          return (
            <button
              key={et.id}
              onClick={() => setSelectedEventTypeId(isSelected ? null : et.id)}
              className={`w-full text-left bg-[#1a1a1a] border rounded-xl p-4 transition-all ${
                isSelected ? 'border-[#f5c842]' : 'border-[#2e2e2e] hover:border-[#3e3e3e]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{et.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-white">{et.name}</p>
                  <p className="text-xs text-gray-500">
                    {et.day_of_week != null ? dayOfWeekLabel(et.day_of_week) : ''} · {et.participant_type} · {et.scoring_method.replace('_', '/')}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  hasPeriod ? 'bg-green-900/40 text-green-400' : 'bg-[#2e2e2e] text-gray-500'
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
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">{selectedET.name}</h3>
            {!activePeriod && (
              <button
                onClick={() => createPeriod(selectedET.id)}
                className="text-xs bg-[#f5c842] text-black font-bold px-3 py-1.5 rounded-lg"
              >
                Start Period
              </button>
            )}
          </div>

          {!activePeriod ? (
            <p className="text-sm text-gray-500">No active period. Start one to enter scores.</p>
          ) : (
            <>
              <p className="text-xs text-gray-500">Period: {activePeriod.label}</p>

              {/* Branch on scoring method — driven by DB config, no hardcoding */}
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
