'use client'

import { useState } from 'react'

interface Props {
  userId:          string
  initialBalance:  number
  customerLabel?:  string
}

type Mode = 'delta' | 'set'

const MAX_CREDIT = 500    // keep in sync with the API route
const MAX_DEBIT  = 5000

export default function AdjustPointsPanel({ userId, initialBalance, customerLabel }: Props) {
  const [mode, setMode]           = useState<Mode>('delta')
  const [balance, setBalance]     = useState(initialBalance)
  const [deltaStr, setDeltaStr]   = useState('')
  const [targetStr, setTargetStr] = useState('')
  const [reason, setReason]       = useState('')
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [message, setMessage]     = useState('')
  const [isError, setIsError]     = useState(false)

  // Compute the signed delta implied by the current input, regardless of mode.
  // Returns null if the input isn't a valid integer yet.
  function computedDelta(): number | null {
    if (mode === 'delta') {
      const n = Number(deltaStr)
      if (deltaStr === '' || deltaStr === '-' || !Number.isFinite(n) || !Number.isInteger(n)) {
        return null
      }
      return n
    }
    const t = Number(targetStr)
    if (targetStr === '' || !Number.isFinite(t) || !Number.isInteger(t) || t < 0) {
      return null
    }
    return t - balance
  }

  const delta = computedDelta()
  const projected = delta !== null ? balance + delta : null

  // Client-side validation mirrors the API so the confirm button can disable.
  let clientError: string | null = null
  if (delta !== null) {
    if (delta === 0) clientError = 'Adjustment is zero — nothing to change'
    else if (delta > MAX_CREDIT) clientError = `Cap: can credit at most +${MAX_CREDIT} per adjustment`
    else if (delta < -MAX_DEBIT) clientError = `Cap: can debit at most ${MAX_DEBIT} per adjustment`
    else if (projected !== null && projected < 0) clientError = `Would take balance below zero (${projected})`
  }

  const canSubmit =
    delta !== null && !clientError && reason.trim().length > 0 && !saving

  async function handleSave() {
    if (!canSubmit) return
    setSaving(true)
    setMessage('')
    setIsError(false)

    const body: Record<string, unknown> = { userId, reason: reason.trim() }
    if (mode === 'delta') body.delta = delta
    else                  body.targetBalance = Number(targetStr)

    const res  = await fetch('/api/staff/customer/adjust-points', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))

    if (res.ok) {
      setBalance(json.newBalance ?? balance)
      setMessage(`✓ Adjusted by ${json.delta >= 0 ? '+' : ''}${json.delta} → ${json.newBalance} pts`)
      setIsError(false)
      setDeltaStr('')
      setTargetStr('')
      setReason('')
      setConfirming(false)
      setTimeout(() => setMessage(''), 5000)
    } else {
      setMessage(json.error ?? `Error: ${res.status}`)
      setIsError(true)
    }
    setSaving(false)
  }

  function reset() {
    setDeltaStr('')
    setTargetStr('')
    setReason('')
    setConfirming(false)
    setMessage('')
    setIsError(false)
  }

  return (
    <div className="space-y-3">
      {/* Current balance */}
      <div className="bg-[#F7F5EF] rounded-xl px-4 py-2 flex items-center justify-between">
        <span className="text-xs text-[#7E613F]">Current balance</span>
        <span className="text-sm font-bold text-[#96321F]">{balance.toLocaleString()} pts</span>
      </div>

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => { setMode('delta');  reset() }}
          className={`text-xs font-semibold py-2 rounded-lg border transition-colors ${
            mode === 'delta'
              ? 'border-[#96321F] bg-[#96321F] text-white'
              : 'border-[#D4CFC3] bg-[#FFFFFF] text-[#7E613F] hover:border-[#96321F]/40'
          }`}
        >
          Credit / Debit
        </button>
        <button
          onClick={() => { setMode('set');    reset() }}
          className={`text-xs font-semibold py-2 rounded-lg border transition-colors ${
            mode === 'set'
              ? 'border-[#96321F] bg-[#96321F] text-white'
              : 'border-[#D4CFC3] bg-[#FFFFFF] text-[#7E613F] hover:border-[#96321F]/40'
          }`}
        >
          Set balance to…
        </button>
      </div>

      {/* Amount input */}
      {mode === 'delta' ? (
        <div>
          <label className="text-xs text-[#7E613F] mb-1 block">
            Amount (use negative to debit, e.g. <code>-4500</code>)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={deltaStr}
            onChange={e => setDeltaStr(e.target.value.replace(/[^\-0-9]/g, ''))}
            placeholder="+100 or -4500"
            className="w-full border border-[#D4CFC3] rounded-lg px-3 py-2 text-sm text-[#242622] placeholder-[#C8BCA4] focus:outline-none focus:border-[#96321F] transition-colors"
          />
        </div>
      ) : (
        <div>
          <label className="text-xs text-[#7E613F] mb-1 block">
            New balance (current: {balance.toLocaleString()})
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={targetStr}
            onChange={e => setTargetStr(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="e.g. 500"
            className="w-full border border-[#D4CFC3] rounded-lg px-3 py-2 text-sm text-[#242622] placeholder-[#C8BCA4] focus:outline-none focus:border-[#96321F] transition-colors"
          />
        </div>
      )}

      {/* Reason */}
      <div>
        <label className="text-xs text-[#7E613F] mb-1 block">
          Reason <span className="text-[#96321F]">*</span>
        </label>
        <input
          type="text"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. 'Correcting 10x Toast import'"
          maxLength={500}
          className="w-full border border-[#D4CFC3] rounded-lg px-3 py-2 text-sm text-[#242622] placeholder-[#C8BCA4] focus:outline-none focus:border-[#96321F] transition-colors"
        />
      </div>

      {/* Preview */}
      {delta !== null && (
        <div className={`rounded-xl px-4 py-3 text-xs space-y-1 border ${
          clientError
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-[#F7F5EF] border-[#D4CFC3] text-[#242622]'
        }`}>
          {!clientError && (
            <p>
              {delta >= 0 ? 'Credit' : 'Debit'}{' '}
              <strong>{Math.abs(delta).toLocaleString()}</strong> pts →{' '}
              new balance <strong>{projected?.toLocaleString()}</strong>
            </p>
          )}
          {clientError && <p>{clientError}</p>}
          <p className="text-[10px] text-[#9E8F7E]">
            Caps per adjustment: +{MAX_CREDIT} credit / −{MAX_DEBIT} debit
          </p>
        </div>
      )}

      {/* Action buttons */}
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          disabled={!canSubmit}
          className="w-full bg-[#96321F] text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-40 hover:bg-[#ae3a24] transition-colors"
        >
          Review Adjustment
        </button>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#96321F]/30 rounded-xl p-4 space-y-3">
          <p className="text-sm text-[#242622]">
            Apply <strong>{delta! >= 0 ? '+' : ''}{delta!.toLocaleString()} pts</strong>
            {customerLabel ? ` to ${customerLabel}` : ''}?
          </p>
          <p className="text-xs text-[#7E613F]">
            New balance will be <strong>{projected?.toLocaleString()} pts</strong>. This is
            recorded as a staff adjustment in the point history.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-[#96321F] text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-40 hover:bg-[#ae3a24] transition-colors"
            >
              {saving ? 'Saving…' : 'Confirm Adjustment'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-[#D4CFC3] text-sm text-[#7E613F] hover:bg-[#F1F1E7] transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={`text-sm text-center font-medium ${isError ? 'text-red-600' : 'text-[#87A67F]'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
