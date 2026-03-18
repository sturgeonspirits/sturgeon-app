'use client'

import { useState } from 'react'
import type { EventType, LeaderboardPeriod } from '@/lib/supabase/types'
import { ordinal, relativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Props {
  eventType:     EventType
  currentPeriod: LeaderboardPeriod | null
  periods:       LeaderboardPeriod[]
  entries:       any[]   // individual scores with profiles joined
  teams:         any[]   // team scores with members joined
  allTime:       any[]   // leaderboard_cache rows with profiles joined
  currentUserId?: string
}

type View = 'current' | 'alltime'

export default function LeaderboardBoard({
  eventType, currentPeriod, periods, entries, teams, allTime, currentUserId
}: Props) {
  const [view, setView] = useState<View>('current')

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex bg-[#1a1a1a] rounded-xl p-1 gap-1">
        {(['current', 'alltime'] as View[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
              view === v
                ? 'bg-[#2e2e2e] text-white'
                : 'text-gray-500 hover:text-gray-300'
            )}
          >
            {v === 'current' ? (currentPeriod?.label ?? 'This Week') : 'All Time'}
          </button>
        ))}
      </div>

      {/* No data state */}
      {view === 'current' && !currentPeriod && (
        <div className="text-center py-12 text-gray-600">
          <p className="text-4xl mb-3">{eventType.icon}</p>
          <p className="font-medium">No active leaderboard yet</p>
          <p className="text-sm mt-1">Check back after the next event night</p>
        </div>
      )}

      {/* Current period — branch on scoring method */}
      {view === 'current' && currentPeriod && (
        <div className="space-y-2">
          {eventType.participant_type === 'team' ? (
            <TeamBoard teams={teams} currentUserId={currentUserId} eventType={eventType} />
          ) : eventType.scoring_method === 'wins_losses' ? (
            <WinsLossesBoard entries={entries} currentUserId={currentUserId} />
          ) : (
            <PointsBoard entries={entries} currentUserId={currentUserId} />
          )}
        </div>
      )}

      {/* All-time */}
      {view === 'alltime' && (
        <AllTimeBoard rows={allTime} eventType={eventType} currentUserId={currentUserId} />
      )}
    </div>
  )
}

// ── Cribbage: wins / losses ──────────────────────────────────

function WinsLossesBoard({ entries, currentUserId }: { entries: any[]; currentUserId?: string }) {
  const sorted = [...entries].sort((a, b) => b.wins - a.wins || a.losses - b.losses)
  return (
    <div className="space-y-2">
      {sorted.map((e, i) => {
        const isMe = e.user_id === currentUserId
        return (
          <div key={e.id} className={cn(
            'bg-[#1a1a1a] border rounded-xl px-4 py-3 flex items-center gap-3',
            isMe ? 'border-[#f5c842]/40' : 'border-[#2e2e2e]'
          )}>
            <span className="text-gray-500 text-sm w-6 text-center font-mono">{ordinal(i + 1)}</span>
            <div className="flex-1">
              <p className={cn('font-semibold text-sm', isMe ? 'text-[#f5c842]' : 'text-white')}>
                {e.profiles?.display_name ?? 'Unknown'}
                {isMe && <span className="ml-2 text-xs text-[#f5c842]/60">you</span>}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-sm">{e.wins}W – {e.losses}L</p>
              {e.wins + e.losses > 0 && (
                <p className="text-xs text-gray-500">
                  {Math.round((e.wins / (e.wins + e.losses)) * 100)}% win
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Trivia individual: ranked by score ──────────────────────

function PointsBoard({ entries, currentUserId }: { entries: any[]; currentUserId?: string }) {
  const sorted = [...entries].sort((a, b) => b.score - a.score)
  return (
    <div className="space-y-2">
      {sorted.map((e, i) => {
        const isMe = e.user_id === currentUserId
        const medal = ['🥇', '🥈', '🥉'][i]
        return (
          <div key={e.id} className={cn(
            'bg-[#1a1a1a] border rounded-xl px-4 py-3 flex items-center gap-3',
            isMe ? 'border-[#5aadff]/40' : 'border-[#2e2e2e]'
          )}>
            <span className="w-7 text-center">{medal ?? <span className="text-gray-500 text-sm">{i + 1}</span>}</span>
            <p className={cn('flex-1 font-semibold text-sm', isMe ? 'text-[#5aadff]' : 'text-white')}>
              {e.profiles?.display_name ?? 'Unknown'}
              {isMe && <span className="ml-2 text-xs text-[#5aadff]/60">you</span>}
            </p>
            <p className="text-white font-bold">{e.score.toLocaleString()} pts</p>
          </div>
        )
      })}
    </div>
  )
}

// ── Trivia teams: ranked by placement ───────────────────────

function TeamBoard({ teams, currentUserId, eventType }: { teams: any[]; currentUserId?: string; eventType: EventType }) {
  const sorted = [...teams].sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99))
  return (
    <div className="space-y-2">
      {sorted.map((team, i) => {
        const memberIds: string[] = (team.leaderboard_team_members ?? []).map((m: any) => m.user_id)
        const isMyTeam = currentUserId && memberIds.includes(currentUserId)
        const medal = ['🥇', '🥈', '🥉'][i]
        return (
          <div key={team.id} className={cn(
            'bg-[#1a1a1a] border rounded-xl p-4',
            isMyTeam ? 'border-[#b06aff]/40' : 'border-[#2e2e2e]'
          )}>
            <div className="flex items-center gap-3 mb-2">
              <span className="w-7 text-center">{medal ?? <span className="text-gray-500 text-sm">{i + 1}</span>}</span>
              <p className={cn('flex-1 font-semibold', isMyTeam ? 'text-[#b06aff]' : 'text-white')}>
                {team.name}
                {isMyTeam && <span className="ml-2 text-xs text-[#b06aff]/60">your team</span>}
              </p>
              <p className="text-white font-bold text-sm">{team.score.toLocaleString()} pts</p>
            </div>
            {/* Team members */}
            <div className="flex flex-wrap gap-1 ml-10">
              {(team.leaderboard_team_members ?? []).map((m: any) => (
                <span key={m.user_id} className="text-xs bg-[#2e2e2e] text-gray-400 px-2 py-0.5 rounded-full">
                  {m.profiles?.display_name ?? 'Member'}
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── All-time board ───────────────────────────────────────────

function AllTimeBoard({ rows, eventType, currentUserId }: { rows: any[]; eventType: EventType; currentUserId?: string }) {
  if (rows.length === 0) {
    return <p className="text-center text-gray-600 py-8">No all-time records yet</p>
  }

  const isWinsLosses = eventType.scoring_method === 'wins_losses'

  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        const isMe = row.user_id === currentUserId
        return (
          <div key={`${row.event_type_id}-${row.user_id}`} className={cn(
            'bg-[#1a1a1a] border rounded-xl px-4 py-3 flex items-center gap-3',
            isMe ? 'border-[#f5c842]/40' : 'border-[#2e2e2e]'
          )}>
            <span className="text-gray-500 text-sm w-6 text-center font-mono">{i + 1}</span>
            <p className={cn('flex-1 font-semibold text-sm', isMe ? 'text-[#f5c842]' : 'text-white')}>
              {row.profiles?.display_name ?? 'Unknown'}
              {isMe && <span className="ml-2 text-xs opacity-60">you</span>}
            </p>
            <div className="text-right">
              {isWinsLosses ? (
                <p className="text-white font-bold text-sm">{row.total_wins}W</p>
              ) : (
                <p className="text-white font-bold text-sm">{(row.total_score ?? 0).toLocaleString()} pts</p>
              )}
              <p className="text-xs text-gray-600">{row.events_attended} events</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
