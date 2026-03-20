'use client'

import type { Mission } from '@/lib/supabase/types'
import MissionCard from './MissionCard'

interface Props {
  missions: Mission[]
  completedIds: Set<string>
  userId: string
}

export default function MissionGrid({ missions, completedIds, userId }: Props) {
  // Split: in-progress first, then completed
  const active    = missions.filter(m => !completedIds.has(m.id) || m.is_repeatable)
  const completed = missions.filter(m => completedIds.has(m.id) && !m.is_repeatable)

  return (
    <div className="space-y-2">
      {active.map(m => (
        <MissionCard
          key={m.id}
          mission={m}
          completed={completedIds.has(m.id)}
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
