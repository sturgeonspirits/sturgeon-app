'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        // Supabase sends a 6-digit code (not a link) when emailRedirectTo is omitted
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Stash email so the verify page can use it
    sessionStorage.setItem('otp_email', email.trim().toLowerCase())
    router.push('/auth/verify')
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-3">🐟</div>
          <h1 className="text-2xl font-bold text-[#f5c842]">Sturgeon Spirits</h1>
          <p className="text-sm text-gray-500 mt-1">Spearers Club</p>
        </div>

        <h2 className="text-lg font-semibold text-white mb-1">Sign in</h2>
        <p className="text-sm text-gray-400 mb-6">
          Enter your email and we'll send you a 6-digit code. No password needed.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
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
              className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-[#f5c842] transition-colors text-base"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full bg-[#f5c842] text-black font-semibold py-3.5 rounded-xl disabled:opacity-40 hover:bg-[#f5d060] transition-colors text-base"
          >
            {loading ? 'Sending code…' : 'Send Code'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <a href="/staff/login" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Staff sign in →
          </a>
        </div>
      </div>
    </div>
  )
}
