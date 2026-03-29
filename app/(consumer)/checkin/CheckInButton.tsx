'use client'

import { useState } from 'react'

const POINTS = 15

export default function CheckInButton({ token }: { token: string }) {
  const [state,   setState]   = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [points,  setPoints]  = useState(POINTS)

  async function handleCheckIn() {
    if (state === 'loading' || state === 'success') return
    setState('loading')
    setMessage('')
    try {
      const controller = new AbortController()
      const timeout    = setTimeout(() => controller.abort(), 12000)
      const res  = await fetch('/api/checkin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token }),
        signal:  controller.signal,
      })
      clearTimeout(timeout)
      const json = await res.json()
      if (res.ok) {
        setPoints(json.pointsEarned ?? POINTS)
        setState('success')
      } else {
        setMessage(json.error ?? 'Something went wrong — please try again.')
        setState('error')
      }
    } catch {
      setMessage('Request timed out — please try again.')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="space-y-4 text-center">
        <p className="text-6xl">🎉</p>
        <div>
          <p className="text-3xl font-bold text-[#96321F]">+{points} pts</p>
          <p className="text-sm text-[#7E613F] mt-1">Checked in! Enjoy your visit.</p>
        </div>
        <a
          href="/club"
          className="block w-full bg-[#96321F] text-white font-semibold py-3.5 rounded-2xl text-center hover:bg-[#ae3a24] transition-colors"
        >
          View my profile →
        </a>
      </div>
    )
  }

  if (state === 'error') {
    const alreadyIn = message.toLowerCase().includes('already checked in')
    return (
      <div className="space-y-4 text-center">
        <p className="text-4xl">{alreadyIn ? '✅' : '😕'}</p>
        <p className="text-sm text-[#7E613F]">{message}</p>
        {!alreadyIn && (
          <button
            onClick={() => setState('idle')}
            className="w-full border border-[#D4CFC3] text-sm text-[#7E613F] font-medium py-3 rounded-2xl hover:bg-[#F1F1E7] transition-colors"
          >
            Try again
          </button>
        )}
        <a
          href="/club"
          className="block w-full text-sm text-[#9E8F7E] hover:text-[#7E613F] transition-colors py-2 text-center"
        >
          Back to my profile
        </a>
      </div>
    )
  }

  return (
    <button
      onClick={handleCheckIn}
      disabled={state === 'loading'}
      className="w-full bg-[#96321F] text-white font-bold py-4 rounded-2xl text-lg hover:bg-[#ae3a24] active:scale-[0.98] transition-all disabled:opacity-60"
    >
      {state === 'loading' ? 'Checking in…' : 'Check In →'}
    </button>
  )
}
