// ─────────────────────────────────────────────
// Changelog
//   v2026-04-25.1 — Don't pass completed=true for repeatable missions even
//                   when they've been done before. Keeps Attend/Bring/Win
//                   from greying out after the first completion.
// ─────────────────────────────────────────────

'use client'

import type { Mission } from '@/lib/supabase/types'
import MissionCard from './MissionCard'

interface Props {
  missions: Mission[]
  completedIds: Set<string>
  pendingRequestIds?: Set<string>
  userId: string
}

export default function MissionGrid({ missions, completedIds, pendingRequestIds = new Set(), userId }: Props) {
  // Split: in-progress first, then completed.
  // Repeatable missions are always in-progress regardless of past completions.
  const active    = missions.filter(m => !completedIds.has(m.id) || m.is_repeatable)
  const completed = missions.filter(m => completedIds.has(m.id) && !m.is_repeatable)

  return (
    <div className="space-y-2">
      {active.map(m => (
        <MissionCard
          key={m.id}
          mission={m}
          // For repeatable missions, never show as completed — they should
          // always look fresh and tappable, no matter how many times the
          // member has done it.
          completed={completedIds.has(m.id) && !m.is_repeatable}
          pendingRequest={pendingRequestIds.has(m.id)}
          userId={userId}
        />
      ))}
      {completed.length > 0 && (
        <>
          <p className="text-xs text-[#9E8F7E] uppercase tracking-wider mt-4 mb-2">Completed</p>
          {completed.map(m => (
            <MissionCard key={m.id} mission={m} completed userId={userId} />
          ))}
        </>
      )}
    </div>
  )
}
