// ─────────────────────────────────────────────
// Changelog
//   v2026-07-13.1 — Paginate all row-level fetches via fetchAllRows: PostgREST
//                   caps responses at 1,000 rows, so unique-active counts,
//                   retention, top missions/rewards, and points-economy totals
//                   were silently wrong once tables passed 1,000 rows.
//                   Count-only (head: true) queries are unaffected.
// ─────────────────────────────────────────────
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Staff Dashboard — high-level health metrics for the loyalty app.
 *
 * Time windows are fixed: last 7 days, last 30 days, and all-time.
 * Staff-only — redirects non-staff/admin users to /staff/login.
 */
export default async function StaffMetricsDashboard() {
  // ── Auth (same pattern as /staff) ─────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff/login')

  const STAFF_ROLES = ['staff', 'admin']
  const appRole: string = (user as any).app_metadata?.role ?? ''
  const service = createServiceClient()

  if (!STAFF_ROLES.includes(appRole)) {
    const { data: profileData } = await service
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (!STAFF_ROLES.includes((profileData as any)?.role ?? '')) {
      redirect('/staff/login')
    }
  }

  // ── Time windows ──────────────────────────────────────────────
  const now      = Date.now()
  const DAY      = 24 * 60 * 60 * 1000
  const iso7d    = new Date(now - 7  * DAY).toISOString()
  const iso30d   = new Date(now - 30 * DAY).toISOString()
  const iso60d   = new Date(now - 60 * DAY).toISOString()

  // ── Parallel queries ──────────────────────────────────────────
  const [
    totalCustomers,
    newSignups7d,
    newSignups30d,

    checkins7d,
    checkins30d,
    checkinsAllTime,

    earnEvents7d,
    earnEvents30d,
    earnEventsPrevMonth,

    missionCompletions7d,
    missionCompletions30d,
    missionCompletionsAll,

    redemptions7d,
    redemptions30d,
    redemptionsAll,
    redemptionsPending,

    allMissions,
    allRewards,

    pointsTotals,
  ] = await Promise.all([
    service.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),

    service.from('profiles').select('id', { count: 'exact', head: true })
      .eq('role', 'customer').gte('created_at', iso7d),
    service.from('profiles').select('id', { count: 'exact', head: true })
      .eq('role', 'customer').gte('created_at', iso30d),

    service.from('earn_events').select('id', { count: 'exact', head: true })
      .eq('event_type', 'bar_checkin').gte('created_at', iso7d),
    service.from('earn_events').select('id', { count: 'exact', head: true })
      .eq('event_type', 'bar_checkin').gte('created_at', iso30d),
    service.from('earn_events').select('id', { count: 'exact', head: true })
      .eq('event_type', 'bar_checkin'),

    // For unique-active calculation: we only need user_ids, not full rows.
    // These are separate from the count calls above. Paginated — can exceed
    // 1,000 rows, and PostgREST silently truncates unpaginated responses.
    fetchAllRows((f, t) => service.from('earn_events').select('user_id')
      .gte('created_at', iso7d).order('id').range(f, t)).then(data => ({ data })),
    fetchAllRows((f, t) => service.from('earn_events').select('user_id')
      .gte('created_at', iso30d).order('id').range(f, t)).then(data => ({ data })),
    // Prev-month window for retention: days 30-60 ago
    fetchAllRows((f, t) => service.from('earn_events').select('user_id')
      .gte('created_at', iso60d).lt('created_at', iso30d).order('id').range(f, t))
      .then(data => ({ data })),

    service.from('mission_completions').select('id', { count: 'exact', head: true })
      .gte('completed_at', iso7d),
    service.from('mission_completions').select('id', { count: 'exact', head: true })
      .gte('completed_at', iso30d),
    fetchAllRows((f, t) => service.from('mission_completions').select('id, mission_id')
      .order('id').range(f, t)).then(data => ({ data, count: data.length })),

    service.from('reward_redemptions').select('id', { count: 'exact', head: true })
      .gte('created_at', iso7d),
    service.from('reward_redemptions').select('id', { count: 'exact', head: true })
      .gte('created_at', iso30d),
    fetchAllRows((f, t) => service.from('reward_redemptions').select('id, reward_id')
      .order('id').range(f, t)).then(data => ({ data, count: data.length })),
    service.from('reward_redemptions').select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),

    service.from('missions').select('id, title, icon, points'),
    service.from('rewards').select('id, name, icon, points_cost'),

    // Points economy — full ledger fetch (one row / user), paginated
    fetchAllRows((f, t) => service.from('points_ledger')
      .select('balance, lifetime_earned, lifetime_spent')
      .order('user_id').range(f, t)).then(data => ({ data })),
  ])

  // ── Derive unique-active counts from user_id lists ────────────
  const uniq = (rows: any): number => {
    const s = new Set<string>()
    for (const r of (rows?.data ?? [])) if (r?.user_id) s.add(r.user_id as string)
    return s.size
  }
  const active7d     = uniq(earnEvents7d)
  const active30d    = uniq(earnEvents30d)
  const activePrev30 = uniq(earnEventsPrevMonth)

  // Retention rate: of members who had activity in days 30-60,
  // what % also had activity in the last 30 days?
  const prevMonthIds = new Set<string>(
    (earnEventsPrevMonth?.data ?? []).map((r: any) => r.user_id).filter(Boolean)
  )
  const currMonthIds = new Set<string>(
    (earnEvents30d?.data ?? []).map((r: any) => r.user_id).filter(Boolean)
  )
  let returning = 0
  for (const id of prevMonthIds) if (currMonthIds.has(id)) returning++
  const retentionPct = prevMonthIds.size > 0
    ? Math.round((returning / prevMonthIds.size) * 100)
    : 0

  // ── Points economy aggregation ────────────────────────────────
  const ledgerRows = (pointsTotals?.data ?? []) as any[]
  const totalEarned = ledgerRows.reduce((s, r) => s + (r.lifetime_earned ?? 0), 0)
  const totalSpent  = ledgerRows.reduce((s, r) => s + (r.lifetime_spent  ?? 0), 0)
  const outstanding = ledgerRows.reduce((s, r) => s + (r.balance         ?? 0), 0)
  const redemptionPct = totalEarned > 0
    ? Math.round((totalSpent / totalEarned) * 100)
    : 0

  // ── Top missions (all-time) ───────────────────────────────────
  const missionMap = new Map<string, { title: string; icon: string; points: number }>(
    ((allMissions?.data ?? []) as any[]).map(m => [m.id, {
      title: m.title, icon: m.icon ?? '🎯', points: m.points ?? 0,
    }])
  )
  const missionCountMap = new Map<string, number>()
  for (const c of ((missionCompletionsAll?.data ?? []) as any[])) {
    const id = c.mission_id as string
    missionCountMap.set(id, (missionCountMap.get(id) ?? 0) + 1)
  }
  const topMissions = Array.from(missionCountMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id, count]) => ({
      id,
      count,
      title:  missionMap.get(id)?.title  ?? 'Unknown mission',
      icon:   missionMap.get(id)?.icon   ?? '🎯',
      points: missionMap.get(id)?.points ?? 0,
    }))

  // ── Top rewards (all-time) ────────────────────────────────────
  const rewardMap = new Map<string, { name: string; icon: string; cost: number }>(
    ((allRewards?.data ?? []) as any[]).map(r => [r.id, {
      name: r.name, icon: r.icon ?? '🎁', cost: r.points_cost ?? 0,
    }])
  )
  const rewardCountMap = new Map<string, number>()
  for (const r of ((redemptionsAll?.data ?? []) as any[])) {
    const id = r.reward_id as string
    rewardCountMap.set(id, (rewardCountMap.get(id) ?? 0) + 1)
  }
  const topRewards = Array.from(rewardCountMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id, count]) => ({
      id,
      count,
      name: rewardMap.get(id)?.name ?? 'Unknown reward',
      icon: rewardMap.get(id)?.icon ?? '🎁',
      cost: rewardMap.get(id)?.cost ?? 0,
    }))

  const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString()

  // ── UI helpers ────────────────────────────────────────────────
  const StatCard = ({
    label, value, sub, accent,
  }: { label: string; value: string | number; sub?: string; accent?: boolean }) => (
    <div className={`bg-white border rounded-2xl p-4 ${accent ? 'border-[#96321F]/40' : 'border-[#D4CFC3]'}`}>
      <p className="text-[11px] font-semibold text-[#7E613F] uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-bold text-[#242622] mt-1">{value}</p>
      {sub && <p className="text-xs text-[#7E613F] mt-0.5">{sub}</p>}
    </div>
  )

  const RangeRow = ({
    label, d7, d30, all,
  }: { label: string; d7: number; d30: number; all?: number | null }) => (
    <div className="grid grid-cols-4 gap-3 py-3 border-b border-[#D4CFC3] last:border-0">
      <p className="text-sm font-semibold text-[#242622] col-span-1 flex items-center">{label}</p>
      <div className="text-right">
        <p className="text-lg font-bold text-[#242622]">{fmt(d7)}</p>
        <p className="text-[10px] text-[#7E613F] uppercase">7d</p>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-[#242622]">{fmt(d30)}</p>
        <p className="text-[10px] text-[#7E613F] uppercase">30d</p>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-[#242622]">{all == null ? '—' : fmt(all)}</p>
        <p className="text-[10px] text-[#7E613F] uppercase">All</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#242622]">Metrics Dashboard</h1>
          <p className="text-sm text-[#7E613F]">App health at a glance</p>
        </div>
        <Link
          href="/staff"
          className="text-xs font-semibold text-[#96321F] border border-[#96321F]/30 px-3 py-1.5 rounded-xl hover:bg-[#96321F]/5 transition-colors"
        >
          ← Staff Home
        </Link>
      </div>

      {/* Topline stats */}
      <section>
        <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-3">Members</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total members"  value={fmt(totalCustomers.count)} accent />
          <StatCard
            label="Active 30d"
            value={fmt(active30d)}
            sub={`${fmt(active7d)} in the last 7 days`}
          />
          <StatCard
            label="New signups 7d"
            value={fmt(newSignups7d.count)}
            sub={`${fmt(newSignups30d.count)} in the last 30 days`}
          />
          <StatCard
            label="Retention"
            value={`${retentionPct}%`}
            sub={`${returning} of ${prevMonthIds.size} prev-month members came back`}
          />
        </div>
      </section>

      {/* Activity table */}
      <section>
        <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-3">Activity</h2>
        <div className="bg-white border border-[#D4CFC3] rounded-2xl px-4">
          <RangeRow
            label="Check-ins"
            d7={checkins7d.count ?? 0}
            d30={checkins30d.count ?? 0}
            all={checkinsAllTime.count ?? 0}
          />
          <RangeRow
            label="New signups"
            d7={newSignups7d.count ?? 0}
            d30={newSignups30d.count ?? 0}
            all={totalCustomers.count ?? 0}
          />
          <RangeRow
            label="Missions done"
            d7={missionCompletions7d.count ?? 0}
            d30={missionCompletions30d.count ?? 0}
            all={missionCompletionsAll.count ?? 0}
          />
          <RangeRow
            label="Redemptions"
            d7={redemptions7d.count ?? 0}
            d30={redemptions30d.count ?? 0}
            all={redemptionsAll.count ?? 0}
          />
        </div>
        {(redemptionsPending.count ?? 0) > 0 && (
          <p className="text-xs text-[#96321F] mt-2">
            ⚠️ {redemptionsPending.count} pending redemption{redemptionsPending.count === 1 ? '' : 's'} awaiting staff approval
          </p>
        )}
      </section>

      {/* Points economy */}
      <section>
        <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-3">Points Economy</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Lifetime earned"     value={fmt(totalEarned)} />
          <StatCard label="Lifetime spent"      value={fmt(totalSpent)}  />
          <StatCard label="Outstanding balance" value={fmt(outstanding)} sub="Total pts still held by members" />
          <StatCard
            label="Redemption rate"
            value={`${redemptionPct}%`}
            sub="Spent ÷ earned"
          />
        </div>
      </section>

      {/* Top missions */}
      <section>
        <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-3">Top Missions</h2>
        <div className="bg-white border border-[#D4CFC3] rounded-2xl divide-y divide-[#D4CFC3]">
          {topMissions.length === 0 && (
            <p className="text-sm text-[#7E613F] p-4 text-center">No mission completions yet</p>
          )}
          {topMissions.map((m, i) => (
            <div key={m.id} className="flex items-center gap-3 p-3">
              <p className="text-[10px] font-bold text-[#9E8F7E] w-4">{i + 1}</p>
              <p className="text-xl">{m.icon}</p>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#242622] truncate">{m.title}</p>
                <p className="text-xs text-[#7E613F]">{m.points} pts · completed {m.count}×</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Top rewards */}
      <section>
        <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-3">Top Rewards</h2>
        <div className="bg-white border border-[#D4CFC3] rounded-2xl divide-y divide-[#D4CFC3]">
          {topRewards.length === 0 && (
            <p className="text-sm text-[#7E613F] p-4 text-center">No redemptions yet</p>
          )}
          {topRewards.map((r, i) => (
            <div key={r.id} className="flex items-center gap-3 p-3">
              <p className="text-[10px] font-bold text-[#9E8F7E] w-4">{i + 1}</p>
              <p className="text-xl">{r.icon}</p>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#242622] truncate">{r.name}</p>
                <p className="text-xs text-[#7E613F]">{r.cost} pts · redeemed {r.count}×</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
