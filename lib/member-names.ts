// ─────────────────────────────────────────────
// Changelog
//   v2026-09-02.1 — New: single server-side helper for resolving member
//                   display names/avatars on standings pages. Replaces the
//                   direct `public_profiles` reads added on 2026-08-10, which
//                   returned nothing in production and made every player on
//                   the cribbage standings render as "Member" / "Unknown".
// ─────────────────────────────────────────────
//
// Why the service client
// ----------------------
// Migration 20260810000000 removed the blanket authenticated-read policy on
// `profiles` and pointed member-to-member reads at the `public_profiles` view.
// Those reads come back empty in production, so the standings lost every name.
//
// These call sites are Server Components: nothing here reaches the browser
// except the four fields below, which are exactly the columns `public_profiles`
// was created to expose. Reading them with the service client keeps the same
// privacy posture (the server, not RLS, picks the columns) while removing the
// dependency on a view that isn't answering. It is also the pattern the event
// signup page already uses for the very same lookup.
//
// If the service key is absent (local dev, preview builds), pass the request's
// own Supabase client as `fallbackClient` and the helper degrades to the view.

import { createServiceClient } from '@/lib/supabase/server'

export interface MemberName {
  id:           string
  /** display_name, falling back to full_name — same coalesce as public_profiles. */
  display_name: string | null
  avatar_url:   string | null
  tier:         string | null
}

export type MemberNameMap = Record<string, MemberName>

/** PostgREST puts `.in()` lists in the URL — keep each request well under any limit. */
const CHUNK = 200

function coalesceName(displayName: unknown, fullName: unknown): string | null {
  const d = typeof displayName === 'string' ? displayName.trim() : ''
  if (d) return d
  const f = typeof fullName === 'string' ? fullName.trim() : ''
  return f || null
}

/**
 * Resolve profile ids → { display_name, avatar_url, tier }.
 * Unknown ids are simply absent from the map; callers keep their own fallback.
 */
export async function fetchMemberNames(
  ids:             (string | null | undefined)[],
  fallbackClient?: { from: (t: string) => any },
): Promise<MemberNameMap> {
  const unique = Array.from(new Set(ids.filter((id): id is string => !!id)))
  if (unique.length === 0) return {}

  const out: MemberNameMap = {}

  const useService = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const client: any = useService ? createServiceClient() : fallbackClient
  if (!client) {
    console.error('[member-names] no service key and no fallback client — names will be blank')
    return out
  }

  const table   = useService ? 'profiles' : 'public_profiles'
  const columns = useService
    ? 'id, display_name, full_name, avatar_url, tier'
    : 'id, display_name, avatar_url, tier'

  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK)
    const { data, error } = await client.from(table).select(columns).in('id', slice)

    if (error) {
      // Loud in the server log, invisible to the member — but never silent.
      console.error(`[member-names] ${table} lookup failed: ${error.message}`)
      continue
    }

    for (const p of (data ?? []) as any[]) {
      if (!p?.id) continue
      out[p.id] = {
        id:           p.id,
        display_name: coalesceName(p.display_name, (p as any).full_name),
        avatar_url:   p.avatar_url ?? null,
        tier:         p.tier ?? null,
      }
    }
  }

  return out
}
