'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
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
      // @supabase/ssr's createBrowserClient doesn't auto-parse the hash,
      // so we do it manually and call setSession() directly.
      const hash = window.location.hash
      if (hash && hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.substring(1)) // strip leading '#'
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (!error) {
            // Clear the hash so it isn't reprocessed on back-navigation
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
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <p className="text-gray-400 text-sm">Signing in…</p>
    </div>
  )
}
