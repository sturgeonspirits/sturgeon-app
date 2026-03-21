'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function StaffLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [code,    setCode]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function requestCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    })
    if (error) { setError('Email not recognised. Contact your manager.'); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type:  'email',
    })
    if (error || !data.user) { setError('Invalid or expired code.'); setLoading(false); return }

    // Ensure profile exists
    await supabase.from('profiles').upsert({
      id:           data.user.id,
      email:        data.user.email,
      display_name: data.user.email?.split('@')[0] ?? 'Staff',
    }, { onConflict: 'id', ignoreDuplicates: true })

    // Verify staff role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle()

    if (!profile || !['staff', 'admin'].includes(profile.role ?? '')) {
      await supabase.auth.signOut()
      setError('This account does not have staff access.')
      setLoading(false)
      return
    }

    router.replace('/staff')
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
          <form onSubmit={requestCode} className="space-y-4">
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
              {loading ? 'Sending…' : 'Send Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-4">
            <p className="text-sm text-[#7E613F] text-center mb-2">
              Enter the code sent to <span className="text-[#242622]">{email}</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{8}"
              maxLength={8}
              required
              autoFocus
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="· · · · · ·"
              className="w-full text-center text-2xl font-bold tracking-[0.4em] bg-[#FFFFFF] border border-[#C8BCA4] rounded-xl px-4 py-3.5 text-[#242622] focus:outline-none focus:border-[#96321F] transition-colors"
            />
            {error && <p className="text-[#96321F] text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || code.length < 8}
              className="w-full bg-[#96321F] text-[#FFFFFF] font-semibold py-3.5 rounded-xl disabled:opacity-40 hover:bg-[#ae3a24] transition-colors"
            >
              {loading ? 'Verifying…' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => { setSent(false); setCode('') }}
              className="w-full text-[#7E613F] text-sm hover:text-[#242622] transition-colors"
            >
              ← Different email
            </button>
          </form>
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
