'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ToastInfo {
  toastPoints: number
  appPoints: number
  alreadyHad: boolean
  birthdaySaved: boolean
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [fullName,      setFullName]      = useState('')
  const [preferredName, setPreferredName] = useState('')
  const [phone,         setPhone]         = useState('')
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')
  const [toastInfo,     setToastInfo]     = useState<ToastInfo | null>(null)
  const [showToast,     setShowToast]     = useState(false)

  // Derive last initial automatically from full name
  const lastInitial = fullName.trim().split(' ').filter(Boolean).slice(-1)[0]?.[0]?.toUpperCase() ?? ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) { setError('Full name is required.'); return }
    setError('')
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth/login'); return }

    const displayName = preferredName.trim() || fullName.trim().split(' ')[0]

    const { error: updateError } = await supabase
      .from('profiles')
      .upsert({
        id:             user.id,
        email:          user.email,
        full_name:      fullName.trim(),
        preferred_name: preferredName.trim() || null,
        last_initial:   lastInitial || null,
        phone:          phone.trim() || null,
        display_name:   displayName,
      }, { onConflict: 'id' })

    if (updateError) {
      setError(`Could not save your info: ${updateError.message}`)
      setLoading(false)
      return
    }

    // ── Check for Toast loyalty account ────────────────────────────────────
    try {
      const res = await fetch('/api/auth/link-toast', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.toastInfo && data.toastInfo.appPoints > 0 && !data.toastInfo.alreadyHad) {
          setToastInfo(data.toastInfo)
          setShowToast(true)
          setLoading(false)
          // Auto-continue after 3.5 seconds
          setTimeout(() => router.replace('/club'), 3500)
          return
        }
      }
    } catch {
      // Non-fatal — just continue to club
    }

    router.replace('/club')
  }

  // ── Toast points welcome screen ────────────────────────────────────────────
  if (showToast && toastInfo) {
    return (
      <div className="min-h-screen bg-[#F1F1E7] flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#96321F]/10 border border-[#96321F]/20">
            <span className="text-4xl">🥃</span>
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-[#242622]">Welcome to the Club!</h1>
            <p className="text-sm text-[#7E613F] mt-2">
              We found your Toast loyalty account and imported your points.
            </p>
          </div>
          <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#7E613F]">Toast points</p>
              <p className="text-sm font-bold text-[#242622]">{toastInfo.toastPoints.toLocaleString()} pts</p>
            </div>
            <div className="h-px bg-[#D4CFC3]" />
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#242622] font-semibold">Spearers Club points</p>
              <p className="text-lg font-bold text-[#96321F]">+{toastInfo.appPoints.toLocaleString()} pts</p>
            </div>
            {toastInfo.birthdaySaved && (
              <>
                <div className="h-px bg-[#D4CFC3]" />
                <p className="text-xs text-[#7E613F]">🎂 Birthday imported from your Toast account</p>
              </>
            )}
          </div>
          <p className="text-xs text-[#9E8F7E]">Taking you to the club…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F1F1E7] flex flex-col items-center justify-center px-6 py-12">
      {/* Brand mark */}
      <div className="text-center mb-10">
        <h1 className="font-display text-4xl font-bold tracking-wide text-[#242622] uppercase">
          Spearers Club
        </h1>
        <div className="flex items-center gap-3 mt-3 justify-center">
          <div className="h-px w-10 bg-[#96321F]/40" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#96321F]" />
          <div className="h-px w-10 bg-[#96321F]/40" />
        </div>
        <p className="text-sm text-[#7E613F] mt-3 font-body">
          Tell us a bit about yourself to get started.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">

        {/* Full name */}
        <div>
          <label className="block text-xs font-semibold text-[#7E613F] mb-1.5 uppercase tracking-widest">
            Full Name <span className="text-[#96321F]">*</span>
          </label>
          <input
            type="text"
            autoComplete="name"
            required
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Jane Smith"
            className="w-full bg-white border border-[#D4CFC3] rounded-xl px-4 py-3.5 text-[#242622] placeholder-[#C8BCA4] focus:outline-none focus:border-[#96321F]/60 transition-colors text-base"
          />
          {lastInitial && (
            <p className="text-xs text-[#9E8F7E] mt-1">
              Leaderboard name: {fullName.trim().split(' ')[0]} {lastInitial}.
            </p>
          )}
        </div>

        {/* Preferred / first name */}
        <div>
          <label className="block text-xs font-semibold text-[#7E613F] mb-1.5 uppercase tracking-widest">
            Preferred Name
          </label>
          <input
            type="text"
            autoComplete="nickname"
            value={preferredName}
            onChange={e => setPreferredName(e.target.value)}
            placeholder="What should we call you? (optional)"
            className="w-full bg-white border border-[#D4CFC3] rounded-xl px-4 py-3.5 text-[#242622] placeholder-[#C8BCA4] focus:outline-none focus:border-[#96321F]/60 transition-colors text-base"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-semibold text-[#7E613F] mb-1.5 uppercase tracking-widest">
            Phone Number
          </label>
          <input
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="(920) 555-0100 (optional)"
            className="w-full bg-white border border-[#D4CFC3] rounded-xl px-4 py-3.5 text-[#242622] placeholder-[#C8BCA4] focus:outline-none focus:border-[#96321F]/60 transition-colors text-base"
          />
          <p className="text-xs text-[#9E8F7E] mt-1">
            Helps link your Toast loyalty points if you have them
          </p>
        </div>

        {error && (
          <p className="text-[#96321F] text-sm bg-[#96321F]/8 border border-[#96321F]/20 rounded-lg px-3 py-2.5">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !fullName.trim()}
          className="w-full bg-[#96321F] text-[#F1F1E7] font-semibold py-3.5 rounded-xl disabled:opacity-40 hover:bg-[#ae3a24] active:scale-[0.98] transition-all text-base tracking-wide mt-2"
        >
          {loading ? 'Saving…' : 'Join the Club →'}
        </button>
      </form>
    </div>
  )
}
