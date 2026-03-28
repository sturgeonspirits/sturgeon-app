'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RewardToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const [active, setActive]   = useState(isActive)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function toggle() {
    setLoading(true)
    const next = !active
    setActive(next)
    await fetch('/api/staff/reward', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, is_active: next }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={active ? 'Deactivate' : 'Activate'}
      className={`relative w-10 h-5.5 rounded-full transition-colors disabled:opacity-50 ${active ? 'bg-[#87A67F]' : 'bg-[#D4CFC3]'}`}
      style={{ width: 40, height: 22 }}
    >
      <div className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${active ? 'translate-x-[18px]' : ''}`}
        style={{ width: 18, height: 18 }} />
    </button>
  )
}
