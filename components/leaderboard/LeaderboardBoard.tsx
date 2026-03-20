'use client'

import { useState } from 'react'
import type { EventType, LeaderboardPeriod } from '@/lib/supabase/types'
import { ordinal, relativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Props {
  eventType:     EventType
  currentPeriod: LeaderboardPeriod | null
  periods:       LeaderboardPeriod[]
  entries:       any[]
  teams:         any[]
  allTime:       any[]
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
      <div className="flex bg-[#EDE9DC] rounded-xl p-1 gap-1">
        {(['current', 'alltime'] as View[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
              view === v
                ? 'bg-[#FFFFFF] text-[#242622]'
                : 'text-[#7E613F] hover:text-[#242622]'
            )}
          >
            {v === 'current' ? (currentPeriod?.label ?? 'This Week') : 'All Time'}
          </button>
        ))}
      </div>

      {/* No data state */}
      {view === 'current' && !currentPeriod && (
        <div className="text-center py-12 text-[#7E613F]">
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
  const sorted = [...entries].sort((a, b) =>
    b.wins - a.wins || b.score - a.score || a.losses - b.losses
  )
  return (
    <div className="space-y-2">
      {sorted.map((e, i) => {
        const isMe   = e.user_id === currentUserId
        const spread = e.score ?? 0
        const total  = e.wins + e.losses
        return (
          <div key={e.id} className={cn(
            'bg-[#FFFFFF] border rounded-xl px-4 py-3 flex items-center gap-3',
            isMe ? 'border-[#96321F]/40' : 'border-[#D4CFC3]'
          )}>
            <span className="text-[#7E613F] text-sm w-6 text-center font-mono">{ordinal(i + 1)}</span>
            <div className="flex-1">
              <p className={cn('font-semibold text-sm', isMe ? 'text-[#96321F]' : 'text-[#242622]')}>
                {e.profiles?.display_name ?? 'Unknown'}
                {isMe && <span className="ml-2 text-xs text-[#96321F]/60">you</span>}
              </p>
              {total > 0 && (
                <p className="text-xs text-[#7E613F] mt-0.5">
                  {Math.round((e.wins / total) * 100)}% win rate
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[#242622] font-bold text-sm">{e.wins}W – {e.losses}L</p>
              <p className={cn('text-xs font-mono mt-0.5', spread >= 0 ? 'text-[#87A67F]' : 'text-red-500')}>
                {spread >= 0 ? '+' : ''}{spread} spread
              </p>
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
        const isMe  = e.user_id === currentUserId
        const medal = ['🥇', '🥈', '🥉'][i]
        return (
          <div key={e.id} className={cn(
            'bg-[#FFFFFF] border rounded-xl px-4 py-3 flex items-center gap-3',
            isMe ? 'border-[#7E613F]/40' : 'border-[#D4CFC3]'
          )}>
            <span className="w-7 text-center">{medal ?? <span className="text-[#7E613F] text-sm">{i + 1}</span>}</span>
            <p className={cn('flex-1 font-semibold text-sm', isMe ? 'text-[#7E613F]' : 'text-[#242622]')}>
              {e.profiles?.display_name ?? 'Unknown'}
              {isMe && <span className="ml-2 text-xs text-[#7E613F]/60">you</span>}
            </p>
            <p className="text-[#242622] font-bold">{e.score.toLocaleString()} pts</p>
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
            'bg-[#FFFFFF] border rounded-xl p-4',
            isMyTeam ? 'border-[#87A67F]/40' : 'border-[#D4CFC3]'
          )}>
            <div className="flex items-center gap-3 mb-2">
              <span className="w-7 text-center">{medal ?? <span className="text-[#7E613F] text-sm">{i + 1}</span>}</span>
              <p className={cn('flex-1 font-semibold', isMyTeam ? 'text-[#87A67F]' : 'text-[#242622]')}>
                {team.name}
                {isMyTeam && <span className="ml-2 text-xs text-[#87A67F]/60">your team</span>}
              </p>
              <p className="text-[#242622] font-bold text-sm">{team.score.toLocaleString()} pts</p>
            </div>
            {/* Team members */}
            <div className="flex flex-wrap gap-1 ml-10">
              {(team.leaderboard_team_members ?? []).map((m: any) => (
                <span key={m.user_id} className="text-xs bg-[#EDE9DC] text-[#7E613F] px-2 py-0.5 rounded-full">
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
    return <p className="text-center text-[#7E613F] py-8">No all-time records yet</p>
  }

  const isWinsLosses = eventType.scoring_method === 'wins_losses'

  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        const isMe = row.user_id === currentUserId
        return (
          <div key={`${row.event_type_id}-${row.user_id}`} className={cn(
            'bg-[#FFFFFF] border rounded-xl px-4 py-3 flex items-center gap-3',
            isMe ? 'border-[#96321F]/40' : 'border-[#D4CFC3]'
          )}>
            <span className="text-[#7E613F] text-sm w-6 text-center font-mono">{i + 1}</span>
            <p className={cn('flex-1 font-semibold text-sm', isMe ? 'text-[#96321F]' : 'text-[#242622]')}>
              {row.profiles?.display_name ?? 'Unknown'}
              {isMe && <span className="ml-2 text-xs opacity-60">you</span>}
            </p>
            <div className="text-right">
              {isWinsLosses ? (
                <p className="text-[#242622] font-bold text-sm">{row.total_wins}W</p>
              ) : (
                <p className="text-[#242622] font-bold text-sm">{(row.total_score ?? 0).toLocaleString()} pts</p>
              )}
              <p className="text-xs text-[#7E613F]">{row.events_attended} events</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
