'use client'

// ─────────────────────────────────────────────
// Changelog
//   v2026-08-10.1 — Surface API failures instead of swallowing them. The
//                   fetch response was never checked, so a 500 (every Reject
//                   ever made — see migration 20260810000001) or a 409
//                   overdraft looked identical to success: spinner off,
//                   router.refresh(), row unchanged.
// ─────────────────────────────────────────────

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
  const [error, setError]     = useState<string | null>(null)
  const router = useRouter()

  async function handle(action: 'approve' | 'reject') {
    setLoading(action)
    setError(null)
    try {
      const res = await fetch('/api/staff/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redemptionId,
          staffId,
          status: action === 'approve' ? 'redeemed' : 'rejected',
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Failed (${res.status})`)
        return
      }

      router.refresh()
    } catch {
      setError('Network error — nothing was changed.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
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
      {error && (
        <p className="text-xs text-red-700 max-w-[16rem] text-right">{error}</p>
      )}
    </div>
  )
}
