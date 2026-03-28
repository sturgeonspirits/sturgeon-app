'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { tierLabel } from '@/lib/utils'

type Mission = {
  id: string
  title: string
  icon: string
  points: number
  completion_trigger: string
  is_active: boolean
  is_repeatable: boolean
  min_tier: string
  sort_order: number
}

function triggerLabel(t: string) {
  const map: Record<string, string> = {
    manual_staff:         'Manual',
    qr_scan:              'QR scan',
    event_attendance:     'Attendance',
    toast_purchase:       'Toast purchase',
    journal_entry:        'Journal',
    challenge_completion: 'Challenge',
  }
  return map[t] ?? t
}

function MissionToggle({ mission }: { mission: Mission }) {
  const [active, setActive] = useState(mission.is_active)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function toggle() {
    setSaving(true)
    await fetch('/api/staff/mission', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: mission.id, is_active: !active }),
    })
    setActive(a => !a)
    setSaving(false)
    router.refresh()
  }

  return (
    <button onClick={toggle} disabled={saving}
      className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${active ? 'bg-[#87A67F]' : 'bg-[#D4CFC3]'} disabled:opacity-50`}>
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${active ? 'left-5' : 'left-1'}`} />
    </button>
  )
}

export default function MissionManagePanel({ missions }: { missions: Mission[] }) {
  const active   = missions.filter(m => m.is_active)
  const inactive = missions.filter(m => !m.is_active)

  function MissionRow({ m }: { m: Mission }) {
    return (
      <div className="bg-white border border-[#D4CFC3] rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-xl flex-shrink-0">{m.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#242622] truncate">{m.title}</p>
          <p className="text-xs text-[#7E613F]">
            {triggerLabel(m.completion_trigger)} · +{m.points} pts
            {m.min_tier !== 'newcomer' && ` · ${tierLabel(m.min_tier)}+`}
            {m.is_repeatable && ' · repeatable'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <MissionToggle mission={m} />
          <Link href={`/staff/missions/${m.id}`}
            className="text-xs text-[#7E613F] bg-[#F1F1E7] hover:bg-[#D4CFC3] px-3 py-1.5 rounded-lg transition-colors">
            Edit
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Link href="/staff/missions/new"
        className="flex items-center justify-center gap-2 w-full bg-[#96321F] text-white font-semibold py-3 rounded-xl text-sm hover:bg-[#ae3a24] transition-colors">
        + New Mission
      </Link>

      {active.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-2">
            Active ({active.length})
          </h2>
          <div className="space-y-2">
            {active.map(m => <MissionRow key={m.id} m={m} />)}
          </div>
        </section>
      )}

      {inactive.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-2">
            Inactive ({inactive.length})
          </h2>
          <div className="space-y-2">
            {inactive.map(m => <MissionRow key={m.id} m={m} />)}
          </div>
        </section>
      )}

      {missions.length === 0 && (
        <div className="text-center py-12 text-[#7E613F]">
          <p className="text-3xl mb-2">📋</p>
          <p className="font-semibold">No missions yet</p>
          <p className="text-sm mt-1">Create your first mission above.</p>
        </div>
      )}
    </div>
  )
}
