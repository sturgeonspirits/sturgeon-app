'use client'

import { useState } from 'react'

type State = 'idle' | 'loading' | 'pending' | 'error'

export default function RedeemButton({
  rewardId,
  pointsCost,
  canAfford,
}: {
  rewardId: string
  pointsCost: number
  canAfford: boolean
}) {
  const [state, setState]     = useState<State>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleRedeem() {
    setState('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/rewards/redeem', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rewardId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Something went wrong')
        setState('error')
      } else {
        setState('pending')
      }
    } catch {
      setErrorMsg('Network error — please try again')
      setState('error')
    }
  }

  if (state === 'pending') {
    return (
      <span className="text-xs font-bold text-[#96321F] flex items-center gap-1">
        ✓ Show staff to claim
      </span>
    )
  }

  if (state === 'error') {
    return (
      <div className="text-right">
        <p className="text-xs text-red-600">{errorMsg}</p>
        <button
          onClick={() => setState('idle')}
          className="text-xs text-[#7E613F] underline mt-0.5"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleRedeem}
      disabled={!canAfford || state === 'loading'}
      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#96321F] text-[#FFFFFF] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#ae3a24] transition-colors"
    >
      {state === 'loading' ? '…' : `${pointsCost.toLocaleString()} pts`}
    </button>
  )
}
