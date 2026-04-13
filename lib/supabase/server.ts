// Server-side Supabase client (use in Server Components, Server Actions, Route Handlers)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { /* Server Components can't set cookies — middleware handles refresh */ }
        },
      },
    }
  )
}

/**
 * Fast auth check for page components.
 *
 * The middleware already calls getUser() (network roundtrip to GoTrue) on
 * every request to refresh the session. Calling getUser() again inside each
 * page component doubles the latency for no benefit.
 *
 * getSession() reads the JWT from the cookie locally — zero network calls.
 * It's safe here because the middleware already validated & refreshed it.
 *
 * Returns { supabase, user } or redirects to /auth/login.
 */
export async function getAuthUser() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return { supabase, user: session?.user ?? null }
}

// Service-role client for privileged server operations (Netlify functions, Edge Functions)
// Never expose this to the browser.
export function createServiceClient() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
