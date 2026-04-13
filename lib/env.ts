/**
 * Environment variable validation.
 *
 * Call `validateEnv()` once at server startup (see instrumentation.ts).
 * It throws immediately with a plain-English message if a required var is
 * missing, so you get a clear startup error instead of a cryptic runtime crash
 * deep inside an API route.
 *
 * You can also import the typed constants directly:
 *   import { env } from '@/lib/env'
 *   env.SUPABASE_SERVICE_ROLE_KEY   // string (guaranteed present at runtime)
 */

interface EnvConfig {
  // ─── Required — app will not function without these ───────────────────────
  NEXT_PUBLIC_SUPABASE_URL:     string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY:    string
  QR_HMAC_SECRET:               string
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY:            string
  VAPID_SUBJECT:                string
  // ─── Required with sensible defaults — warn if missing in production ──────
  NEXT_PUBLIC_APP_URL:          string
  CRON_SECRET:                  string
}

const REQUIRED: (keyof EnvConfig)[] = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'QR_HMAC_SECRET',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
]

// Warn (not throw) when missing — these have safe defaults in dev
const RECOMMENDED: string[] = [
  'NEXT_PUBLIC_APP_URL',
  'CRON_SECRET',
]

/**
 * Call once at startup (instrumentation.ts > register()).
 * Throws with a descriptive message listing every missing variable.
 */
export function validateEnv(): void {
  const missing = REQUIRED.filter(k => !process.env[k])

  if (missing.length > 0) {
    throw new Error(
      [
        '─────────────────────────────────────────────────────',
        '  Missing required environment variables:',
        ...missing.map(k => `    ✗ ${k}`),
        '',
        '  Set these in .env.local (dev) or Netlify environment',
        '  variables (production) and restart the server.',
        '─────────────────────────────────────────────────────',
      ].join('\n'),
    )
  }

  if (process.env.NODE_ENV === 'production') {
    const missingRecommended = RECOMMENDED.filter(k => !process.env[k])
    if (missingRecommended.length > 0) {
      console.warn(
        '[env] The following recommended variables are not set:',
        missingRecommended.join(', '),
      )
    }
  }
}

/**
 * Typed, validated environment constants.
 * Only safe to use after validateEnv() has been called.
 */
export const env = {
  NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL!,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  SUPABASE_SERVICE_ROLE_KEY:     process.env.SUPABASE_SERVICE_ROLE_KEY!,
  QR_HMAC_SECRET:                process.env.QR_HMAC_SECRET!,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY:  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  VAPID_PRIVATE_KEY:             process.env.VAPID_PRIVATE_KEY!,
  VAPID_SUBJECT:                 process.env.VAPID_SUBJECT!,
  NEXT_PUBLIC_APP_URL:           process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  CRON_SECRET:                   process.env.CRON_SECRET ?? '',
  NODE_ENV:                      process.env.NODE_ENV ?? 'development',
} as const
