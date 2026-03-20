'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    sessionStorage.setItem('otp_email', email.trim().toLowerCase())
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="grain min-h-screen bg-[#0e0d0b] flex flex-col">
      {/* Ambient glow — warm rust */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[500px] h-[360px] rounded-full bg-[#96321F]/10 blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full bg-[#7E613F]/8 blur-[120px]" />
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Brand mark */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#161410] border border-[#96321F]/30 mb-5 shadow-xl shadow-black/50">
            <span className="text-4xl">🐟</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-[#F1F1E7] tracking-tight">
            Sturgeon Spirits
          </h1>
          <p className="text-xs text-[#7a6e5f] mt-1.5 tracking-[0.2em] uppercase">
            Spearers Club
          </p>
          {/* Decorative rule */}
          <div className="flex items-center gap-3 mt-4 justify-center">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-[#96321F]/40" />
            <div className="w-1 h-1 rounded-full bg-[#96321F]/60" />
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-[#96321F]/40" />
          </div>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm">
          {!sent ? (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-[#F1F1E7]">Sign in</h2>
                <p className="text-sm text-[#7a6e5f] mt-1">
                  We'll send a code to your email — no password needed.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-[#7a6e5f] mb-2 uppercase tracking-widest">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-[#161410] border border-[#2c2820] rounded-xl px-4 py-3.5 text-[#F1F1E7] placeholder-[#3a3228] focus:outline-none focus:border-[#96321F]/60 transition-colors text-base"
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-sm bg-red-950/30 border border-red-900/30 rounded-lg px-3 py-2.5">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full bg-[#96321F] text-[#F1F1E7] font-semibold py-3.5 rounded-xl disabled:opacity-40 hover:bg-[#ae3a24] active:scale-[0.98] transition-all text-base tracking-wide"
                >
                  {loading ? 'Sending…' : 'Send Code'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#96321F]/10 border border-[#96321F]/25 mb-5">
                <span className="text-3xl">✉️</span>
              </div>
              <h2 className="text-lg font-semibold text-[#F1F1E7] mb-2">Check your email</h2>
              <p className="text-sm text-[#7a6e5f] mb-6">
                We sent a sign-in code to<br />
                <span className="text-[#F1F1E7]">{email}</span>
              </p>
              <button
                onClick={() => router.push('/auth/verify')}
                className="w-full bg-[#96321F] text-[#F1F1E7] font-semibold py-3.5 rounded-xl hover:bg-[#ae3a24] active:scale-[0.98] transition-all text-base tracking-wide"
              >
                Enter Code →
              </button>
              <button
                onClick={() => setSent(false)}
                className="mt-3 w-full text-sm text-[#3a3228] hover:text-[#7a6e5f] py-2 transition-colors"
              >
                Use a different email
              </button>
            </div>
          )}
        </div>

        {/* Staff link */}
        <div className="mt-12">
          <a href="/staff/login" className="text-xs text-[#2c2820] hover:text-[#3a3228] transition-colors tracking-wide">
            Staff sign in →
          </a>
        </div>
      </div>
    </div>
  )
}
