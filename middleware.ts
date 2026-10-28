// ─────────────────────────────────────────────
// Changelog
//   v2026-10-27.1 — Record one app open per member per day (record_app_open
//                   RPC), guarded by a daily cookie so it's one write a day.
// ─────────────────────────────────────────────
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — MUST be called before any auth check
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── API routes — never redirect, each handles its own auth ──
  // Routes use requireStaff(), user session cookies, or a secret
  // header (x-sync-secret, x-cron-secret). Redirecting here would
  // return an HTML login page to JSON callers.
  if (pathname.startsWith('/api/')) {
    return supabaseResponse
  }

  // ── Public paths — no auth required ─────────────────────
  const publicPaths = [
    '/auth/login',
    '/auth/verify',
    '/auth/callback',
    '/dev-login',
    '/display',      // public tablet check-in QR display
  ]
  if (publicPaths.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return supabaseResponse
  }

  // ── /staff/login → redirect to unified login ─────────────
  if (pathname === '/staff/login' || pathname.startsWith('/staff/login/')) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // ── Unauthenticated: redirect to login, preserving the original URL ──
  if (!user) {
    const loginUrl = new URL('/auth/login', request.url)
    // Preserve the full path + query so we can bounce back after login
    const returnTo = request.nextUrl.pathname + request.nextUrl.search
    if (returnTo && returnTo !== '/') {
      loginUrl.searchParams.set('redirect', returnTo)
    }
    return NextResponse.redirect(loginUrl)
  }

  // ── Usage: record one app open per member per day ───────────
  // Cookie holds the Chicago date of the last recorded open, so this is one
  // RPC per device per day. Never let it block or break a page load.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date())
  if (request.cookies.get(OPEN_COOKIE)?.value !== today) {
    try {
      const { error } = await supabase.rpc('record_app_open')
      if (!error) {
        supabaseResponse.cookies.set(OPEN_COOKIE, today, {
          path: '/', httpOnly: true, sameSite: 'lax', secure: true, maxAge: 60 * 60 * 36,
        })
      }
    } catch { /* usage logging is best-effort */ }
  }

  return supabaseResponse
}

const OPEN_COOKIE = 'ss_open_day'

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
