'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [fullName,      setFullName]      = useState('')
  const [preferredName, setPreferredName] = useState('')
  const [phone,         setPhone]         = useState('')
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')

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
      .update({
        full_name:      fullName.trim(),
        preferred_name: preferredName.trim() || null,
        last_initial:   lastInitial || null,
        phone:          phone.trim() || null,
        display_name:   displayName,
      })
      .eq('id', user.id)

    if (updateError) {
      setError(`Could not save your info: ${updateError.message}`)
      setLoading(false)
      return
    }

    router.replace('/club')
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
