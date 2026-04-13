/**
 * Daily check-in token utilities.
 *
 * Tokens are HMAC-SHA256 of the current date (in America/Chicago time) using
 * CHECKIN_SECRET from the environment. They rotate at midnight local time.
 * Yesterday's token is also accepted to handle midnight edge-cases.
 *
 * Set CHECKIN_SECRET in your Netlify environment variables.
 */
import { createHmac } from 'crypto'

const TZ     = 'America/Chicago'
// Accept either name so a single VAPID-style secret covers both token systems.
// QR_HMAC_SECRET is the canonical name set in .env.local / Netlify; CHECKIN_SECRET
// is a legacy alias kept for backwards compatibility.
const SECRET = () =>
  process.env.QR_HMAC_SECRET ??
  process.env.CHECKIN_SECRET ??
  'dev-checkin-secret-change-me'

/** Returns date string YYYY-MM-DD in America/Chicago time */
export function localDate(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}

/** Generate today's check-in token */
export function getDailyToken(): string {
  return makeToken(localDate())
}

/** Returns true if token matches today's or yesterday's date (midnight buffer) */
export function validateDailyToken(token: string): boolean {
  return token === makeToken(localDate(0)) || token === makeToken(localDate(-1))
}

function makeToken(dateStr: string): string {
  return createHmac('sha256', SECRET()).update(dateStr).digest('hex').slice(0, 24)
}
