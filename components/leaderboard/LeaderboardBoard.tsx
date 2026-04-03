'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EventType, LeaderboardPeriod } from '@/lib/supabase/types'
import { ordinal, privateName } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Props {
  eventType:          EventType
  currentPeriod:      LeaderboardPeriod | null
  periods:            LeaderboardPeriod[]
  entries:            any[]
  teams:              any[]
  allTime:            any[]
  currentUserId?:     string
  slug:               string
  openPeriodId?:      string | null
  userCurrentTeamId?: string | null
}

type View = 'current' | 'alltime'

export default function LeaderboardBoard({
  eventType, currentPeriod, periods, entries, teams, allTime, currentUserId, slug,
  openPeriodId, userCurrentTeamId,
}: Props) {
  const [view, setView] = useState<View>('current')
  const router = useRouter()

  function selectPeriod(periodId: string) {
    router.push(`/leaderboards/${slug}?period=${periodId}`)
  }

  // Format a period label into a short date string for the picker
  function shortLabel(period: LeaderboardPeriod) {
    // Try to parse a date out of the label (e.g. "Thursday, March 26, 2026")
    const d = new Date(period.label)
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    // Fallback: use starts_at
    if (period.starts_at) {
      const sd = new Date(period.starts_at)
      if (!isNaN(sd.getTime())) {
        return sd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }
    }
    return period.label
  }

  return (
    <div className="space-y-4">
      {/* Main tab switcher */}
      <div className="flex bg-[#EDE9DC] rounded-xl p-1 gap-1">
        <button
          onClick={() => setView('current')}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
            view === 'current'
              ? 'bg-[#FFFFFF] text-[#242622]'
              : 'text-[#7E613F] hover:text-[#242622]'
          )}
        >
          {currentPeriod?.label ?? 'Nights'}
        </button>
        <button
          onClick={() => setView('alltime')}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
            view === 'alltime'
              ? 'bg-[#FFFFFF] text-[#242622]'
              : 'text-[#7E613F] hover:text-[#242622]'
          )}
        >
          All Time
        </button>
      </div>

      {/* Date picker — shown in 'current' view when multiple periods exist */}
      {view === 'current' && periods.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          {periods.map(p => {
            const isSelected = p.id === currentPeriod?.id
            return (
              <button
                key={p.id}
                onClick={() => selectPeriod(p.id)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap',
                  isSelected
                    ? 'bg-[#96321F] text-white border-[#96321F]'
                    : 'bg-[#FFFFFF] text-[#7E613F] border-[#D4CFC3] hover:border-[#96321F]/40'
                )}
              >
                {shortLabel(p)}
              </button>
            )
          })}
        </div>
      )}

      {/* No data state */}
      {view === 'current' && !currentPeriod && (
        <div className="text-center py-12 text-[#7E613F]">
          <p className="text-4xl mb-3">{eventType.icon}</p>
          <p className="font-medium">No scores recorded yet</p>
          <p className="text-sm mt-1">Check back after the next event night</p>
        </div>
      )}

      {/* Current period — branch on scoring method */}
      {view === 'current' && currentPeriod && (
        <div className="space-y-2">
          {eventType.participant_type === 'team' ? (
            <TeamBoard
              teams={teams}
              currentUserId={currentUserId}
              eventType={eventType}
              openPeriodId={openPeriodId}
              userCurrentTeamId={userCurrentTeamId}
            />
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
  if (sorted.length === 0) {
    return (
      <div className="text-center py-10 text-[#7E613F]">
        <p className="text-3xl mb-2">🃏</p>
        <p className="font-medium text-sm">No scores recorded yet</p>
        <p className="text-xs mt-1 text-[#9E8F7E]">Staff can enter tonight's results from the portal</p>
      </div>
    )
  }
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
                {privateName(e.profiles?.display_name)}
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
  if (sorted.length === 0) {
    return (
      <div className="text-center py-10 text-[#7E613F]">
        <p className="text-3xl mb-2">📊</p>
        <p className="font-medium text-sm">No scores recorded yet</p>
        <p className="text-xs mt-1 text-[#9E8F7E]">Staff can enter tonight's results from the portal</p>
      </div>
    )
  }
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
              {privateName(e.profiles?.display_name)}
              {isMe && <span className="ml-2 text-xs text-[#7E613F]/60">you</span>}
            </p>
            <p className="text-[#242622] font-bold">{(e.score ?? 0).toLocaleString()} pts</p>
          </div>
        )
      })}
    </div>
  )
}

// ── Trivia teams: ranked by placement ───────────────────────

function TeamBoard({
  teams, currentUserId, eventType, openPeriodId, userCurrentTeamId,
}: {
  teams:              any[]
  currentUserId?:     string
  eventType:          EventType
  openPeriodId?:      string | null
  userCurrentTeamId?: string | null
}) {
  const [joiningId,   setJoiningId]   = useState<string | null>(null)
  const [joinedTeamId,setJoinedTeamId]= useState<string | null>(userCurrentTeamId ?? null)
  const [joinError,   setJoinError]   = useState<string | null>(null)

  // canJoin: open period, user logged in, not already on a team
  const canJoin = !!openPeriodId && !!currentUserId && !joinedTeamId

  async function handleJoin(permanentTeamId: string, periodTeamId: string) {
    if (!openPeriodId || joiningId) return
    setJoiningId(permanentTeamId)
    setJoinError(null)
    try {
      const res = await fetch('/api/join/team-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodId: openPeriodId, teamId: permanentTeamId }),
      })
      const json = await res.json()
      if (res.ok) {
        setJoinedTeamId(periodTeamId)  // mark the leaderboard_teams id as joined
      } else {
        setJoinError(json.error ?? 'Could not join team')
      }
    } catch {
      setJoinError('Request failed — please try again')
    } finally {
      setJoiningId(null)
    }
  }

  const sorted = [...teams].sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99))

  return (
    <div className="space-y-2">
      {/* Banner when the night is open and user hasn't joined yet */}
      {canJoin && (
        <div className="bg-[#EDE9DC] border border-[#C8BCA4] rounded-xl px-4 py-3 text-sm text-[#7E613F]">
          🍸 Tonight&apos;s event is open — tap a team below to join and earn points!
        </div>
      )}

      {joinError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
          {joinError}
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="text-center py-10 text-[#7E613F]">
          <p className="text-3xl mb-2">🥃</p>
          <p className="font-medium text-sm">No teams yet</p>
          <p className="text-xs mt-1 text-[#9E8F7E]">
            {openPeriodId ? 'Be the first to join!' : 'Check back after the next event night'}
          </p>
        </div>
      ) : (
        sorted.map((team, i) => {
          const memberIds: string[] = (team.leaderboard_team_members ?? []).map((m: any) => m.user_id)
          const isMyTeam    = (joinedTeamId === team.id) || (!joinedTeamId && !!currentUserId && memberIds.includes(currentUserId))
          const isJoining   = joiningId === team.permanent_team_id
          const medal       = ['🥇', '🥈', '🥉'][i]
          const showJoinBtn = canJoin && !isMyTeam

          return (
            <div key={team.id} className={cn(
              'bg-[#FFFFFF] border rounded-xl p-4 transition-all',
              isMyTeam ? 'border-[#87A67F]/40' : 'border-[#D4CFC3]',
              showJoinBtn ? 'hover:border-[#96321F]/40 cursor-pointer' : ''
            )}
              onClick={showJoinBtn ? () => handleJoin(team.permanent_team_id, team.id) : undefined}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="w-7 text-center">{medal ?? <span className="text-[#7E613F] text-sm">{i + 1}</span>}</span>
                <p className={cn('flex-1 font-semibold', isMyTeam ? 'text-[#87A67F]' : 'text-[#242622]')}>
                  {team.name}
                  {isMyTeam && <span className="ml-2 text-xs text-[#87A67F]/60">your team</span>}
                </p>
                {showJoinBtn ? (
                  <span className="text-xs font-bold text-[#96321F] shrink-0">
                    {isJoining ? 'Joining…' : 'Join →'}
                  </span>
                ) : (
                  <p className="text-[#242622] font-bold text-sm">{(team.score ?? 0).toLocaleString()} pts</p>
                )}
              </div>
              <div className="flex flex-wrap gap-1 ml-10">
                {(team.leaderboard_team_members ?? []).map((m: any) => (
                  <span key={m.user_id} className="text-xs bg-[#EDE9DC] text-[#7E613F] px-2 py-0.5 rounded-full">
                    {privateName(m.profiles?.display_name)}
                  </span>
                ))}
              </div>
            </div>
          )
        })
      )}
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
        const isMe  = row.user_id === currentUserId
        const medal = ['🥇', '🥈', '🥉'][i]
        return (
          <div key={`${row.event_type_id}-${row.user_id}`} className={cn(
            'bg-[#FFFFFF] border rounded-xl px-4 py-3 flex items-center gap-3',
            isMe ? 'border-[#96321F]/40' : 'border-[#D4CFC3]'
          )}>
            <span className="w-7 text-center">{medal ?? <span className="text-[#7E613F] text-sm font-mono">{ordinal(i + 1)}</span>}</span>
            <p className={cn('flex-1 font-semibold text-sm', isMe ? 'text-[#96321F]' : 'text-[#242622]')}>
              {privateName(row.profiles?.display_name)}
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
