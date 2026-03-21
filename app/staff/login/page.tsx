'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function StaffLoginPage() {
  const supabase = createClient()
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function requestLink(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: window.location.origin + '/staff/auth/callback',
      },
    })
    if (error) { setError('Email not recognised. Contact your manager.'); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="grain min-h-screen bg-[#F1F1E7] flex flex-col items-center justify-center p-6">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[400px] h-[300px] rounded-full bg-[#96321F]/8 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-block bg-[#96321F]/10 border border-[#96321F]/25 text-[#96321F] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-4">
            Staff Console
          </div>
          <h1 className="text-xl font-bold text-[#242622]">Sturgeon Spirits</h1>
          <p className="text-sm text-[#7E613F] mt-1">Staff sign in</p>
        </div>

        {!sent ? (
          <form onSubmit={requestLink} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#7E613F] mb-1.5 uppercase tracking-widest">
                Staff email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@sturgeonspirits.com"
                className="w-full bg-[#FFFFFF] border border-[#C8BCA4] rounded-xl px-4 py-3.5 text-[#242622] placeholder-[#9E8F7E] focus:outline-none focus:border-[#96321F] transition-colors"
              />
            </div>
            {error && <p className="text-[#96321F] text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#96321F] text-[#FFFFFF] font-semibold py-3.5 rounded-xl disabled:opacity-40 hover:bg-[#ae3a24] transition-colors"
            >
              {loading ? 'Sending…' : 'Send Login Link'}
            </button>
          </form>
        ) : (
          <div className="text-center space-y-4">
            <div className="text-4xl">📬</div>
            <p className="text-[#242622] font-semibold">Check your email</p>
            <p className="text-sm text-[#7E613F]">
              We sent a login link to <span className="text-[#242622]">{email}</span>.<br />
              Click it to access the staff console.
            </p>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              className="text-sm text-[#9E8F7E] hover:text-[#7E613F] transition-colors mt-4"
            >
              ← Try a different email
            </button>
          </div>
        )}

        <div className="mt-8 text-center">
          <a href="/auth/login" className="text-xs text-[#9E8F7E] hover:text-[#7E613F] transition-colors">
            Member login →
          </a>
        </div>
      </div>
    </div>
  )
}
