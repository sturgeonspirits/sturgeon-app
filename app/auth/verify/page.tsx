'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Envelope } from '@/components/icons/brand'

export default function VerifyPage() {
  const router = useRouter()
  const supabase = createClient()
  const [digits, setDigits] = useState(['', '', '', '', '', '', '', ''])
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
    if (clean && index < 7) inputRefs.current[index + 1]?.focus()

    // Auto-submit when all 8 digits filled
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
      email,
      token: code,
      type: 'email',
    })

    if (error || !data.user) {
      setError('Invalid or expired code. Try again.')
      setDigits(['', '', '', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
      setLoading(false)
      return
    }

    sessionStorage.removeItem('otp_email')

    // Route by role — new users go to onboarding, staff/admin to staff portal
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', data.user.id)
      .maybeSingle()

    if (!profile || !profile.full_name) {
      router.replace('/onboarding')
      return
    }
    const role = profile.role ?? 'customer'

    // Check for a redirect URL stored during login (e.g. /checkin?t=TOKEN)
    const savedRedirect = sessionStorage.getItem('auth_redirect')
    sessionStorage.removeItem('auth_redirect')
    if (savedRedirect && !['staff', 'admin'].includes(role)) {
      router.replace(savedRedirect)
      return
    }
    router.replace(['staff', 'admin'].includes(role) ? '/staff' : '/club')
  }

  async function resendCode() {
    setError('')
    await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
    setDigits(['', '', '', '', '', '', '', ''])
    inputRefs.current[0]?.focus()
  }

  return (
    <div className="grain min-h-screen bg-[#F1F1E7] flex flex-col items-center justify-center p-6">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[400px] h-[300px] rounded-full bg-[#96321F]/8 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#96321F]/10 border border-[#96321F]/20 mb-4">
            <Envelope size={30} className="text-[#96321F]" />
          </div>
          <h1 className="text-xl font-bold text-[#242622]">Check your email</h1>
          <p className="text-sm text-[#7E613F] mt-2">
            We sent an 8-digit code to<br />
            <span className="text-[#242622] font-medium">{email}</span>
          </p>
        </div>

        {/* 8-digit code inputs */}
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

        {loading && (
          <p className="text-center text-[#96321F] text-sm mb-4">Verifying…</p>
        )}

        {error && (
          <p className="text-red-600 text-sm text-center bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <div className="text-center space-y-3 mt-4">
          <button onClick={resendCode} className="text-sm text-[#7E613F] hover:text-[#242622] transition-colors">
            Resend code
          </button>
          <br />
          <a href="/auth/login" className="text-xs text-[#9E8F7E] hover:text-[#7E613F] transition-colors">
            ← Use a different email
          </a>
        </div>
      </div>
    </div>
  )
}
