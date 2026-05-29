// Browser-side Supabase client (use in Client Components)
// ─────────────────────────────────────────────
// Changelog
//   v2026-05-29.1 — Import Database from ./database.types (auto-generated,
//                   complete) instead of ./types (hand-maintained, missing
//                   ~15 tables → data typed as `never`).
// ─────────────────────────────────────────────
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
