import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  // Only works in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.redirect(new URL('/auth/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'))
  }

  const email = process.env.NEXT_PUBLIC_DEV_EMAIL || 'info@sturgeonspirits.com'
  const origin = 'http://localhost:3000'

  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        // Must match site_url or additional_redirect_urls in supabase/config.toml
        redirectTo: `http://127.0.0.1:3000/auth/callback`,
      },
    })

    if (error || !data?.properties?.action_link) {
      console.error('[dev-auth] generateLink error:', error)
      return NextResponse.redirect(`${origin}/auth/login?error=dev_auth_failed`)
    }

    // Redirect the browser through the magic link — Supabase will set the session
    // and then redirect to /auth/callback which sends us to /club
    return NextResponse.redirect(data.properties.action_link)
  } catch (err) {
    console.error('[dev-auth] unexpected error:', err)
    return NextResponse.redirect(`${origin}/auth/login?error=dev_auth_exception`)
  }
}
