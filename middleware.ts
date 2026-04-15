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

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
