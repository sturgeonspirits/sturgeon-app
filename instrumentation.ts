/**
 * Next.js instrumentation hook — runs once when the server starts,
 * before any requests are handled.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only validate on the server (not in the Edge runtime or browser bundle)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('@/lib/env')
    validateEnv()
  }
}
