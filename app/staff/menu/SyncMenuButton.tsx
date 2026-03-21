'use client'

import { useState } from 'react'

export default function SyncMenuButton() {
  const [status, setStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSync() {
    setStatus('syncing')
    setMessage('')
    try {
      const res = await fetch('/api/sync-menu', {
        method: 'POST',
        headers: { 'x-sync-secret': 'sturgeon-sync' },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setStatus('done')
      setMessage(`✓ ${json.synced} recipes synced`)
      // Refresh the page after a moment to show updated data
      setTimeout(() => window.location.reload(), 1500)
    } catch (err: any) {
      setStatus('error')
      setMessage(err.message ?? 'Sync failed')
    }
  }

  return (
    <div className="text-right">
      <button
        onClick={handleSync}
        disabled={status === 'syncing'}
        className="bg-[#96321F] text-[#FFFFFF] text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#ae3a24] disabled:opacity-50 active:scale-95 transition-all"
      >
        {status === 'syncing' ? 'Syncing…' : '↻ Sync Menu'}
      </button>
      {message && (
        <p className={`text-xs mt-1 ${status === 'error' ? 'text-red-600' : 'text-[#87A67F]'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
