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
  if (!user) redirect('/staff/login')

  const service = createServiceClient()
  const { q: rawQ } = await searchParams
  const q = (rawQ ?? '').trim()

  let query = service
    .from('profiles')
    .select('id, display_name, full_name, email, role, points_total, created_at')
    .eq('role', 'customer')
    .order('created_at', { ascending: false })
    .limit(50)

  if (q) {
    query = query.or(`display_name.ilike.%${q}%,full_name.ilike.%${q}%,email.ilike.%${q}%`)
  }

  const { data: customers } = await query
  const rows = customers ?? []

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
          {rows.map(c => (
            <div key={c.id} className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl px-4 py-3 flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-[#96321F]/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-[#96321F]">
                  {(c.display_name ?? c.full_name ?? c.email ?? '?')[0]?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#242622] truncate">
                  {c.display_name ?? c.full_name ?? 'Unnamed'}
                </p>
                <p className="text-xs text-[#7E613F] truncate">{c.email}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-[#242622]">{c.points_total ?? 0}</p>
                <p className="text-[10px] text-[#9E8F7E]">pts</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
