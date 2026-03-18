'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function StaffLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function requestCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },  // staff must pre-exist in DB
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
      type: 'email',
    })
    if (error || !data.user) { setError('Invalid or expired code.'); setLoading(false); return }

    // Confirm role before granting access
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (!profile || !['staff', 'admin'].includes(profile.role)) {
      await supabase.auth.signOut()
      setError('This account does not have staff access.')
      setLoading(false)
      return
    }

    router.replace('/staff')
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-block bg-[#f5c842]/10 border border-[#f5c842]/30 text-[#f5c842] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-4">
            Staff Console
          </div>
          <h1 className="text-xl font-bold text-white">Sturgeon Spirits</h1>
          <p className="text-sm text-gray-500 mt-1">Staff login</p>
        </div>

        {!sent ? (
          <form onSubmit={requestCode} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Staff email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="staff@sturgeonspiritsdistillery.com"
                className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-[#f5c842] transition-colors"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-[#f5c842] text-black font-semibold py-3.5 rounded-xl disabled:opacity-40">
              {loading ? 'Sending…' : 'Send Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-4">
            <p className="text-sm text-gray-400 text-center mb-2">
              Enter the 6-digit code sent to <span className="text-white">{email}</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full text-center text-2xl font-bold tracking-widest bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-[#f5c842] transition-colors"
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button type="submit" disabled={loading || code.length !== 6} className="w-full bg-[#f5c842] text-black font-semibold py-3.5 rounded-xl disabled:opacity-40">
              {loading ? 'Verifying…' : 'Sign In'}
            </button>
            <button type="button" onClick={() => setSent(false)} className="w-full text-gray-500 text-sm hover:text-gray-300">
              ← Different email
            </button>
          </form>
        )}

        <div className="mt-8 text-center">
          <a href="/auth/login" className="text-xs text-gray-600 hover:text-gray-400">Member login →</a>
        </div>
      </div>
    </div>
  )
}
