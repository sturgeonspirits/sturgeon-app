'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function StaffLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [digits,  setDigits]  = useState(['', '', '', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (sent) inputRefs.current[0]?.focus()
  }, [sent])

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

  function handleDigitChange(index: number, value: string) {
    const clean = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = clean
    setDigits(next)
    if (clean && index < 7) inputRefs.current[index + 1]?.focus()
    const code = next.join('')
    if (code.length === 8) verifyCode(code)
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8)
    if (text.length === 8) {
      setDigits(text.split(''))
      verifyCode(text)
    }
  }

  async function verifyCode(code: string) {
    setError('')
    setLoading(true)
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code,
      type:  'email',
    })
    if (error || !data.user) {
      setError('Invalid or expired code. Try again.')
      setDigits(['', '', '', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
      setLoading(false)
      return
    }
    // Exact same pattern as /auth/verify which is confirmed working
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
          <div>
            <p className="text-sm text-[#7E613F] text-center mb-6">
              Enter the 8-digit code sent to <span className="text-[#242622] font-medium">{email}</span>
            </p>
            <div className="flex gap-1.5 justify-center mb-6" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]"
                  maxLength={1}
                  value={d}
                  disabled={loading}
                  onChange={e => handleDigitChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className="w-10 h-14 text-center text-xl font-bold bg-[#FFFFFF] border border-[#C8BCA4] rounded-xl text-[#242622] focus:outline-none focus:border-[#96321F] disabled:opacity-40 transition-colors"
                />
              ))}
            </div>
            {loading && <p className="text-center text-[#96321F] text-sm mb-4">Verifying…</p>}
            {error && (
              <p className="text-[#96321F] text-sm text-center bg-[#96321F]/8 border border-[#96321F]/20 rounded-lg px-3 py-2 mb-4">
                {error}
              </p>
            )}
            <button
              onClick={() => { setSent(false); setDigits(['', '', '', '', '', '', '', '']); setError('') }}
              className="w-full text-[#7E613F] text-sm hover:text-[#242622] transition-colors mt-2"
            >
              ← Different email
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
