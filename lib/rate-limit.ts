/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * Suitable for a single-process Next.js deployment (Netlify/Vercel functions
 * run in isolated workers, so this is per-instance — good enough for a small
 * bar loyalty app where the risk is accidental double-taps, not DDoS).
 *
 * Usage:
 *   const { ok, retryAfter } = rateLimit(ip, 'checkin', 5, 60)
 *   if (!ok) return Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })
 */

interface Window {
  count:     number
  resetAt:   number   // epoch seconds
}

// key → window
const store = new Map<string, Window>()

// Prune stale entries every ~5 minutes to avoid unbounded growth
let lastPrune = Date.now()
function maybePrune() {
  const now = Date.now()
  if (now - lastPrune < 5 * 60 * 1000) return
  lastPrune = now
  const nowSec = Math.floor(now / 1000)
  for (const [k, v] of store) {
    if (v.resetAt < nowSec) store.delete(k)
  }
}

/**
 * @param identifier  IP address or user ID
 * @param action      Bucket name (e.g. 'checkin', 'redeem')
 * @param limit       Max requests per window
 * @param windowSecs  Window length in seconds
 */
export function rateLimit(
  identifier: string,
  action: string,
  limit: number,
  windowSecs: number,
): { ok: boolean; retryAfter: number } {
  maybePrune()

  const key    = `${action}:${identifier}`
  const nowSec = Math.floor(Date.now() / 1000)
  const entry  = store.get(key)

  if (!entry || entry.resetAt <= nowSec) {
    // New window
    store.set(key, { count: 1, resetAt: nowSec + windowSecs })
    return { ok: true, retryAfter: 0 }
  }

  if (entry.count < limit) {
    entry.count++
    return { ok: true, retryAfter: 0 }
  }

  return { ok: false, retryAfter: entry.resetAt - nowSec }
}

/** Extract the real client IP from Next.js request headers. */
export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}
