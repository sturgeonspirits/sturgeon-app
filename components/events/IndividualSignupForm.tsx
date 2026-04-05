'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  periodId:     string
  eventName:    string
  eventIcon:    string
  eventDate:    string
  isRegistered: boolean
}

export default function IndividualSignupForm({
  periodId, eventName, eventIcon, eventDate, isRegistered: initialIsRegistered,
}: Props) {
  const router = useRouter()
  const [isRegistered, setIsRegistered] = useState(initialIsRegistered)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  async function handleRegister() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/join/register-individual', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ periodId }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error ?? 'Could not register'); return }
    setIsRegistered(true)
    router.refresh()
  }

  async function handleUnregister() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/join/leave', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ periodId }),
    })
    setLoading(false)
    if (!res.ok) { setError('Could not cancel'); return }
    setIsRegistered(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="text-5xl mb-2">{eventIcon}</div>
        <h1 className="text-2xl font-bold text-[#242622]">{eventName}</h1>
        <p className="text-[#7E613F] mt-1">{eventDate}</p>
      </div>

      {isRegistered ? (
        <div className="bg-[#87A67F]/15 border border-[#87A67F] rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#5a7a54] uppercase tracking-widest font-medium mb-1">
              You&apos;re signed up!
            </p>
            <p className="text-sm text-[#242622]">See you there — we&apos;ll record your score after the game.</p>
          </div>
          <button
            onClick={handleUnregister}
            disabled={loading}
            className="text-xs text-[#96321F] hover:text-[#ae3a24] font-medium disabled:opacity-40 transition-colors ml-4 shrink-0"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[#7E613F] text-center">
            Add your name to the list — no team needed, just show up and play!
          </p>
          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full bg-[#96321F] text-white font-semibold py-4 rounded-2xl text-base disabled:opacity-40 hover:bg-[#ae3a24] active:scale-[0.98] transition-all"
          >
            {loading ? 'Signing up…' : 'Sign Me Up'}
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  )
}
