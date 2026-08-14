// ─────────────────────────────────────────────
// Changelog
//   v2026-08-14.1 — Show a Roster badge for name-only members and skip the
//                   "no Toast link" hint for them (they can never have one).
// ─────────────────────────────────────────────
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function StaffCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const service = createServiceClient()
  const { q: rawQ } = await searchParams
  const q = (rawQ ?? '').trim()

  let query = service
    .from('profiles')
    .select('id, display_name, full_name, email, role, tier, created_at, pos_customer_id, is_roster')
    .not('role', 'in', '("staff","admin")')
    .order('created_at', { ascending: false })
    .limit(50)

  if (q) {
    query = query.or(`display_name.ilike.%${q}%,full_name.ilike.%${q}%,email.ilike.%${q}%`)
  }

  const { data: customers } = await query
  const rows = customers ?? []

  // Pull points balances + Toast data for all returned profiles in one shot
  const profileIds = rows.map(c => c.id)
  const [{ data: ledgerRows }, { data: toastRows }] = await Promise.all([
    profileIds.length > 0
      ? service.from('points_ledger').select('user_id, balance').in('user_id', profileIds)
      : { data: [] },
    profileIds.length > 0
      ? service.from('toast_loyalty_accounts')
          .select('profile_id, toast_points, card_number, last_trans_at')
          .in('profile_id', profileIds)
      : { data: [] },
  ])

  const balanceMap = Object.fromEntries((ledgerRows ?? []).map(l => [l.user_id, l.balance]))
  const toastMap   = Object.fromEntries((toastRows  ?? []).map(t => [t.profile_id, t]))

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#242622]">Customers</h1>
          <p className="text-sm text-[#7E613F] mt-0.5">
            {q ? `Results for "${q}"` : `${rows.length} most recent members`}
          </p>
        </div>
        <Link
          href="/staff/customers/new"
          className="bg-[#96321F] text-[#FFFFFF] text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#ae3a24] transition-colors"
        >
          + Add Customer
        </Link>
      </div>

      {/* Search */}
      <form method="GET" className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C8BCA4] pointer-events-none"
          width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by name or email…"
          className="w-full bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#242622] placeholder-[#C8BCA4] focus:outline-none focus:border-[#96321F] transition-colors"
        />
      </form>

      {rows.length === 0 ? (
        <div className="text-center py-14 bg-[#FFFFFF] rounded-2xl border border-[#D4CFC3]">
          <p className="text-4xl mb-3">👤</p>
          <p className="font-semibold text-[#242622] mb-1">{q ? 'No customers found' : 'No customers yet'}</p>
          <p className="text-sm text-[#7E613F] mb-4">
            {q ? 'Try a different name or email' : 'Add a customer manually or have them sign up via the app'}
          </p>
          {!q && (
            <Link
              href="/staff/customers/new"
              className="inline-block bg-[#96321F] text-[#FFFFFF] font-bold px-5 py-2.5 rounded-xl hover:bg-[#ae3a24] transition-colors text-sm"
            >
              Add First Customer
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {rows.map(c => {
            const balance  = balanceMap[c.id] ?? 0
            const toast    = toastMap[c.id] ?? null
            return (
              <Link key={c.id} href={`/staff/customers/${c.id}`} className="block bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl px-4 py-3 flex items-center gap-4 hover:border-[#96321F]/40 transition-colors">
                <div className="w-9 h-9 rounded-full bg-[#96321F]/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-[#96321F]">
                    {(c.display_name ?? c.email ?? '?')[0]?.toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#242622] truncate flex items-center gap-1.5">
                    {c.display_name ?? (c as any).full_name ?? 'Unnamed'}
                    {(c as any).is_roster && (
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#7E613F] bg-[#EDE9DC] border border-[#D4CFC3] rounded px-1.5 py-0.5">
                        Roster
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[#7E613F] truncate">
                    {(c as any).is_roster ? 'No email — record only' : c.email}
                  </p>
                  {toast && (
                    <p className="text-xs text-[#9E8F7E] mt-0.5">
                      🍞 Toast: {toast.toast_points} pts
                      {toast.last_trans_at && (
                        <span className="ml-1 opacity-70">
                          · last visit {new Date(toast.last_trans_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {(c as any).is_roster ? (
                    <p className="text-xs text-[#9E8F7E]">no points</p>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-[#242622]">{balance.toLocaleString()} pts</p>
                      <p className="text-xs text-[#7E613F] capitalize">{c.tier ?? 'newcomer'}</p>
                      {!toast && !c.pos_customer_id && (
                        <p className="text-[10px] text-[#C8BCA4] mt-0.5">no Toast link</p>
                      )}
                    </>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
