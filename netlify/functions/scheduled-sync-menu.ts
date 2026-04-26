/* v1.0 — created 2026-04-25
   changes: Replaces scheduled-sync-menu.mts. The .mts extension was
   loaded by Netlify's build (function appeared as "Scheduled") but
   the runtime never executed it — even "Run now" produced no logs.
   Switching to .ts to use the better-supported function bundler path.
   Currently TEMP every-minute schedule; revert to '0 8 * * *' once verified. */

/**
 * Daily automated menu sync.
 *
 * Runs on Netlify's cron scheduler and POSTs to the app's own
 * /api/sync-menu endpoint with the x-cron-secret header. The endpoint
 * does the actual Google Sheet → Supabase work (see app/api/sync-menu/route.ts).
 *
 * Schedule is defined both here (as the canonical source) and mirrored
 * in netlify.toml under [functions."scheduled-sync-menu"].
 */

export default async () => {
  console.log('[scheduled-sync-menu] handler entered at', new Date().toISOString())

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[scheduled-sync-menu] CRON_SECRET is not set')
    return new Response('CRON_SECRET not configured', { status: 500 })
  }

  // Netlify sets URL to the primary site URL in production, and
  // DEPLOY_PRIME_URL for deploy previews. Prefer the primary URL.
  const siteUrl =
    process.env.URL ??
    process.env.DEPLOY_PRIME_URL ??
    'https://sturgeon-app.netlify.app'

  const started = Date.now()
  try {
    const res = await fetch(`${siteUrl}/api/sync-menu`, {
      method: 'POST',
      headers: { 'x-cron-secret': cronSecret },
    })

    const body = await res.text()
    const tookMs = Date.now() - started

    if (!res.ok) {
      console.error(
        `[scheduled-sync-menu] ${res.status} after ${tookMs}ms — ${body.slice(0, 500)}`
      )
      return new Response(`Sync failed: ${res.status}`, { status: 502 })
    }

    console.log(`[scheduled-sync-menu] OK in ${tookMs}ms — ${body.slice(0, 300)}`)
    return new Response('ok', { status: 200 })
  } catch (err: any) {
    console.error('[scheduled-sync-menu] fetch error:', err?.message ?? err)
    return new Response('Sync errored', { status: 500 })
  }
}

// TEMP DIAGNOSTIC: every minute. Verifying the scheduler fires at all.
// Production schedule is '0 8 * * *' (08:00 UTC = 3 AM CDT). REVERT after testing.
export const config = {
  schedule: '* * * * *',
}
