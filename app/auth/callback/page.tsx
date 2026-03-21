'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function AuthCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    async function handleCallback() {
      const supabase = createClient()

      // ── PKCE flow: ?code= query param (standard OTP / OAuth) ──────────
      const code = searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          router.replace('/club')
          return
        }
      }

      // ── Implicit flow: #access_token= hash fragment ────────────────────
      const hash = window.location.hash
      if (hash && hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.substring(1))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (!error) {
            window.history.replaceState(null, '', window.location.pathname)
            router.replace('/club')
            return
          }
        }
      }

      // ── Fallback: maybe already signed in ─────────────────────────────
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace('/club')
      } else {
        router.replace('/auth/login?error=callback_failed')
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen bg-[#F1F1E7] flex items-center justify-center">
      <p className="text-[#242622] text-sm">Signing in…</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F1F1E7] flex items-center justify-center">
        <p className="text-[#242622] text-sm">Signing in…</p>
      </div>
    }>
      <AuthCallbackInner />
    </Suspense>
  )
}
