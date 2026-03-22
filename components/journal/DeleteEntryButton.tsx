'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteEntryButton({ logId }: { logId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading,    setLoading]    = useState(false)

  async function handleDelete() {
    setLoading(true)
    const res = await fetch('/api/journal-entry', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ logId }),
    })
    if (res.ok) {
      router.refresh()
    } else {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-[#7E613F] px-2 py-1 rounded-lg hover:bg-[#EDE9DC] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs text-[#FFFFFF] bg-red-500 px-2 py-1 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          {loading ? '…' : 'Remove'}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-[#C8BCA4] hover:text-red-400 transition-colors p-1 -m-1"
      aria-label="Remove entry"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6M14 11v6"/>
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
      </svg>
    </button>
  )
}
