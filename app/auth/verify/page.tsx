'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function VerifyPage() {
  const router = useRouter()
  const supabase = createClient()
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const stored = sessionStorage.getItem('otp_email')
    if (!stored) { router.replace('/auth/login'); return }
    setEmail(stored)
    inputRefs.current[0]?.focus()
  }, [router])

  function handleDigitChange(index: number, value: string) {
    const clean = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = clean
    setDigits(next)
    if (clean && index < 5) inputRefs.current[index + 1]?.focus()

    // Auto-submit when all 6 digits filled
    const code = next.join('')
    if (code.length === 6) verifyCode(code)
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      setDigits(text.split(''))
      verifyCode(text)
    }
  }

  async function verifyCode(code: string) {
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    })

    if (error) {
      setError('Invalid or expired code. Try again.')
      setDigits(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
      setLoading(false)
      return
    }

    sessionStorage.removeItem('otp_email')
    router.replace('/club')
  }

  async function resendCode() {
    setError('')
    await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
    setDigits(['', '', '', '', '', ''])
    inputRefs.current[0]?.focus()
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-5xl mb-3">📬</div>
          <h1 className="text-xl font-bold text-white">Check your email</h1>
          <p className="text-sm text-gray-400 mt-2">
            We sent a 6-digit code to<br />
            <span className="text-white font-medium">{email}</span>
          </p>
        </div>

        {/* 6-digit code inputs */}
        <div className="flex gap-3 justify-center mb-6" onPaste={handlePaste}>
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
              className="w-12 h-14 text-center text-xl font-bold bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl text-white focus:outline-none focus:border-[#f5c842] disabled:opacity-40 transition-colors"
            />
          ))}
        </div>

        {loading && (
          <p className="text-center text-[#f5c842] text-sm mb-4">Verifying…</p>
        )}

        {error && (
          <p className="text-red-400 text-sm text-center bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <div className="text-center space-y-3 mt-4">
          <button onClick={resendCode} className="text-sm text-gray-400 hover:text-white transition-colors">
            Resend code
          </button>
          <br />
          <a href="/auth/login" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            ← Use a different email
          </a>
        </div>
      </div>
    </div>
  )
}
