'use client'

import { useState, useRef, useCallback } from 'react'

interface SyncCounters {
  total: number
  active: number
  skippedDeactivated: number
  upserted: number
  matchedEmail: number
  matchedPhone: number
  unmatched: number
  pointsImported: number
  birthdaysSaved: number
  errors: number
}

interface SyncResult {
  ok: boolean
  counters: SyncCounters
  error?: string
}

export default function ToastSyncPage() {
  const [dragOver, setDragOver]   = useState(false)
  const [file, setFile]           = useState<File | null>(null)
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<SyncResult | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const inputRef                  = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith('.csv')) {
      setError('Please upload a .csv file exported from Toast.')
      return
    }
    setFile(f)
    setResult(null)
    setError(null)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const onDragLeave = useCallback(() => setDragOver(false), [])

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleSync = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const form = new FormData()
      form.append('file', file)

      const resp = await fetch('/api/staff/toast-sync', {
        method: 'POST',
        body: form,
      })
      const data = await resp.json()
      if (!resp.ok || data.error) {
        setError(data.error ?? 'Sync failed. Please try again.')
      } else {
        setResult(data)
      }
    } catch (e: any) {
      setError(e.message ?? 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setResult(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#242622]">Toast Loyalty Sync</h1>
        <p className="text-sm text-[#7E613F] mt-0.5">
          Upload a RewardsCards CSV from Toast to sync loyalty points with the app.
        </p>
      </div>

      {/* How-to steps */}
      <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 space-y-2">
        <p className="text-xs font-semibold text-[#7E613F] uppercase tracking-wide">How to export from Toast</p>
        <ol className="text-sm text-[#242622] space-y-1 list-decimal list-inside">
          <li>Log in to <span className="font-medium">Toast Web</span> → <span className="font-medium">Guests → Loyalty</span></li>
          <li>Click <span className="font-medium">Export</span> (top-right) → choose <span className="font-medium">RewardsCards</span></li>
          <li>Download the CSV and upload it below</li>
        </ol>
        <p className="text-xs text-[#9E8F7E] mt-1">
          Run this whenever you want to pull in fresh Toast point balances.
          New app sign-ups are automatically linked without a re-import.
        </p>
      </div>

      {/* Drop zone / file picker */}
      {!result && (
        <div>
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => inputRef.current?.click()}
            className={`
              cursor-pointer border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 transition-colors
              ${dragOver
                ? 'border-[#96321F] bg-[#96321F]/5'
                : 'border-[#D4CFC3] bg-[#FFFFFF] hover:border-[#96321F] hover:bg-[#96321F]/5'}
            `}
          >
            <div className="text-4xl">📄</div>
            {file ? (
              <div className="text-center">
                <p className="font-semibold text-[#242622]">{file.name}</p>
                <p className="text-xs text-[#7E613F]">{(file.size / 1024).toFixed(1)} KB — ready to sync</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="font-semibold text-[#242622]">Drop RewardsCards.csv here</p>
                <p className="text-xs text-[#7E613F]">or click to browse</p>
              </div>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={onInputChange}
          />

          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSync}
              disabled={!file || loading}
              className="flex-1 bg-[#96321F] text-white font-bold py-3 rounded-xl disabled:opacity-40 hover:bg-[#ae3a24] transition-colors text-sm"
            >
              {loading ? 'Syncing…' : 'Sync Now'}
            </button>
            {file && !loading && (
              <button
                onClick={reset}
                className="px-4 py-3 rounded-xl border border-[#D4CFC3] text-sm text-[#7E613F] hover:bg-[#F1F1E7] transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {loading && (
            <div className="mt-4 bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-[#96321F] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[#7E613F]">Processing CSV and syncing accounts…</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success result */}
      {result?.ok && result.counters && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">✅</span>
              <p className="font-bold text-green-800">Sync Complete</p>
            </div>
            <p className="text-sm text-green-700">Toast loyalty data has been updated successfully.</p>
          </div>

          <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl divide-y divide-[#D4CFC3]">
            <Row label="Rows in CSV"         value={result.counters.total.toLocaleString()} />
            <Row label="Active cards"         value={result.counters.active.toLocaleString()} />
            <Row label="Skipped (deactivated)" value={result.counters.skippedDeactivated.toLocaleString()} muted />
            <Row label="Accounts upserted"   value={result.counters.upserted.toLocaleString()} />
            <Row label="Matched by email"    value={result.counters.matchedEmail.toLocaleString()} />
            <Row label="Matched by phone"    value={result.counters.matchedPhone.toLocaleString()} />
            <Row label="Unmatched (no app account)" value={result.counters.unmatched.toLocaleString()} muted />
            <Row label="Points imported"     value={result.counters.pointsImported.toLocaleString()} highlight />
            <Row label="Birthdays saved"     value={result.counters.birthdaysSaved.toLocaleString()} />
            {result.counters.errors > 0 && (
              <Row label="Errors"            value={result.counters.errors.toLocaleString()} warn />
            )}
          </div>

          <p className="text-xs text-[#9E8F7E]">
            Unmatched accounts are stored and will automatically link the next time a customer signs up
            using the same email or phone number.
          </p>

          <button
            onClick={reset}
            className="w-full border border-[#D4CFC3] text-sm text-[#7E613F] font-medium py-3 rounded-xl hover:bg-[#F1F1E7] transition-colors"
          >
            Sync Another File
          </button>
        </div>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  muted,
  highlight,
  warn,
}: {
  label: string
  value: string
  muted?: boolean
  highlight?: boolean
  warn?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <p className={`text-sm ${muted ? 'text-[#9E8F7E]' : 'text-[#242622]'}`}>{label}</p>
      <p className={`text-sm font-bold ${
        highlight ? 'text-[#96321F]' :
        warn       ? 'text-red-600'   :
        muted      ? 'text-[#9E8F7E]' :
        'text-[#242622]'
      }`}>
        {value}
      </p>
    </div>
  )
}
