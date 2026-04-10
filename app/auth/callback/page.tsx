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

      async function redirectByRole(userId: string) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', userId)
          .maybeSingle()
        // No profile yet → send to onboarding to collect name/phone
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

      // ── PKCE flow: ?code= query param (standard OTP / OAuth) ──────────
      const code = searchParams.get('code')
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error && data.user) {
          await redirectByRole(data.user.id)
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
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (!error && data.user) {
            window.history.replaceState(null, '', window.location.pathname)
            await redirectByRole(data.user.id)
            return
          }
        }
      }

      // ── Fallback: maybe already signed in ─────────────────────────────
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await redirectByRole(session.user.id)
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
