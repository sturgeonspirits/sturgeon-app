'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RedemptionActions({
  redemptionId,
  staffId,
}: {
  redemptionId: string
  staffId: string
}) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const router = useRouter()

  async function handle(action: 'approve' | 'reject') {
    setLoading(action)
    await fetch('/api/staff/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        redemptionId,
        staffId,
        status: action === 'approve' ? 'redeemed' : 'rejected',
      }),
    })
    setLoading(null)
    router.refresh()
  }

  return (
    <div className="flex gap-1.5">
      <button
        onClick={() => handle('approve')}
        disabled={loading !== null}
        className="text-xs font-bold bg-[#96321F] text-white px-3 py-1.5 rounded-lg hover:bg-[#ae3a24] disabled:opacity-50 transition-colors">
        {loading === 'approve' ? '…' : 'Approve'}
      </button>
      <button
        onClick={() => handle('reject')}
        disabled={loading !== null}
        className="text-xs font-bold bg-[#F1F1E7] text-[#7E613F] px-3 py-1.5 rounded-lg hover:bg-[#D4CFC3] disabled:opacity-50 transition-colors">
        {loading === 'reject' ? '…' : 'Reject'}
      </button>
    </div>
  )
}
