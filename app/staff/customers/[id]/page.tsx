// ─────────────────────────────────────────────
// Changelog
//   v2026-08-14.1 — Roster members get their own view: no points panels (they
//                   can't earn), a record summary, and the claim panel for
//                   linking them to a real account once they sign up.
// ─────────────────────────────────────────────
import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import RedeemPanel from './RedeemPanel'
import AdjustPointsPanel from './AdjustPointsPanel'
import ClaimRosterPanel from './ClaimRosterPanel'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const service = createServiceClient()

  // Fetch customer profile
  const { data: profile } = await service
    .from('profiles')
    .select('id, display_name, full_name, email, phone, tier, created_at, pos_customer_id, birthday, is_roster')
    .eq('id', id)
    .single()

  if (!profile) notFound()

  const isRoster = !!(profile as any).is_roster

  // ── Roster members: no login, no points, so none of the points panels apply.
  // Show what they DO have — an event record — plus the claim path.
  if (isRoster) {
    const rosterName = profile.full_name ?? profile.display_name ?? 'This member'

    // Two queries rather than a PostgREST embed: this codebase has been bitten
    // by the FK schema cache going stale after DDL, and this page ships in the
    // same release as a migration.
    const { data: nights } = await service
      .from('leaderboard_events')
      .select('period_id, wins, losses, score')
      .eq('user_id', id)

    const periodIds = [...new Set((nights ?? []).map((r: any) => r.period_id))]
    const { data: periodRows } = periodIds.length > 0
      ? await service
          .from('leaderboard_periods')
          .select('id, label, starts_at')
          .in('id', periodIds)
      : { data: [] as any[] }

    const periodMap = Object.fromEntries((periodRows ?? []).map((p: any) => [p.id, p]))
    const rows = [...(nights ?? [])].sort((a: any, b: any) =>
      String(periodMap[b.period_id]?.starts_at ?? '').localeCompare(
      String(periodMap[a.period_id]?.starts_at ?? '')))
    const totalWins  = rows.reduce((n: number, r: any) => n + (r.wins   ?? 0), 0)
    const totalLoss  = rows.reduce((n: number, r: any) => n + (r.losses ?? 0), 0)

    return (
      <div className="space-y-6 py-4">
        <Link href="/staff/customers" className="text-xs text-[#7E613F] hover:text-[#96321F] transition-colors">
          ← Customers
        </Link>

        <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-[#EDE9DC] flex items-center justify-center shrink-0">
              <span className="text-xl font-bold text-[#7E613F]">
                {rosterName[0]?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-[#242622]">{rosterName}</h1>
              {profile.phone && <p className="text-sm text-[#7E613F]">{profile.phone}</p>}
              <p className="text-xs text-[#9E8F7E] mt-0.5">No email on file</p>
            </div>
            <span className="text-xs bg-[#EDE9DC] text-[#7E613F] px-2.5 py-1 rounded-full font-medium">
              Roster
            </span>
          </div>

          <p className="text-xs text-[#7E613F] bg-[#F7F5EF] border border-[#EDE9DC] rounded-xl px-3 py-2.5 leading-relaxed">
            A roster member is a name on the board. They can be picked as a cribbage
            opponent and keep a win/loss record across nights, but they can&rsquo;t sign in,
            don&rsquo;t earn points, and aren&rsquo;t matched to Toast.
          </p>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="bg-[#F7F5EF] rounded-xl px-3 py-3 text-center">
              <p className="text-[10px] text-[#7E613F] mb-1 uppercase tracking-wide">Nights</p>
              <p className="text-xl font-bold text-[#242622]">{rows.length}</p>
            </div>
            <div className="bg-[#F7F5EF] rounded-xl px-3 py-3 text-center">
              <p className="text-[10px] text-[#7E613F] mb-1 uppercase tracking-wide">Wins</p>
              <p className="text-xl font-bold text-[#87A67F]">{totalWins}</p>
            </div>
            <div className="bg-[#F7F5EF] rounded-xl px-3 py-3 text-center">
              <p className="text-[10px] text-[#7E613F] mb-1 uppercase tracking-wide">Losses</p>
              <p className="text-xl font-bold text-[#242622]">{totalLoss}</p>
            </div>
          </div>
        </div>

        {rows.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-3">Nights Played</h2>
            <div className="space-y-1">
              {rows.map((r: any) => (
                <div key={r.period_id} className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-[#242622]">{periodMap[r.period_id]?.label ?? 'Event'}</span>
                  <span className="text-sm text-[#7E613F]">
                    {(r.wins ?? 0)}–{(r.losses ?? 0)}
                    <span className="text-xs text-[#9E8F7E] ml-2">
                      {(r.score ?? 0) >= 0 ? '+' : ''}{r.score ?? 0}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-3">Link To A Real Account</h2>
          <ClaimRosterPanel rosterId={id} rosterName={rosterName} />
        </section>
      </div>
    )
  }

  const [
    { data: ledger },
    { data: toastCards },
    { data: redemptions },
    { data: rewards },
    { data: recentEarns },
    { data: allEarns },
  ] = await Promise.all([
    service.from('points_ledger').select('balance').eq('user_id', id).maybeSingle(),
    // Fetch ALL linked Toast cards (duplicates exist; we show the canonical MAX).
    service
      .from('toast_loyalty_accounts')
      .select('toast_points, card_number, last_trans_at, is_deactivated')
      .eq('profile_id', id)
      .eq('is_deactivated', false),
    service
      .from('reward_redemptions')
      .select('id, status, redeemed_at, notes, created_at, rewards(name, icon, points_cost), profiles!redeemed_by(display_name)')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    service
      .from('rewards')
      .select('id, name, icon, description, points_cost, reward_value, redemption_method')
      .eq('is_active', true)
      .order('sort_order'),
    service
      .from('earn_events')
      .select('id, event_type, points_delta, notes, created_at, context_type')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(15),
    // Full earn_events breakdown for the App-awarded vs From-Toast split.
    service
      .from('earn_events')
      .select('points_delta, context_type')
      .eq('user_id', id),
  ])

  const balance = ledger?.balance ?? 0

  // App-awarded vs From-Toast split. Any context_type other than 'toast_import'
  // (including null) counts as app-awarded: missions, rewards, staff adjustments, etc.
  let fromToast = 0
  let appAwarded = 0
  for (const ev of allEarns ?? []) {
    if (ev.context_type === 'toast_import') {
      fromToast += ev.points_delta ?? 0
    } else {
      appAwarded += ev.points_delta ?? 0
    }
  }

  // Canonical Toast POS balance: MAX across duplicate cards.
  const toastPosBalance = (toastCards ?? []).reduce(
    (m: number, c: any) => Math.max(m, c.toast_points ?? 0), 0
  )
  const lastToastVisit = (toastCards ?? []).reduce(
    (latest: string | null, c: any) => {
      if (!c.last_trans_at) return latest
      if (!latest) return c.last_trans_at
      return new Date(c.last_trans_at).getTime() > new Date(latest).getTime() ? c.last_trans_at : latest
    },
    null as string | null
  )

  return (
    <div className="space-y-6 py-4">
      {/* Back */}
      <Link href="/staff/customers" className="text-xs text-[#7E613F] hover:text-[#96321F] transition-colors">
        ← Customers
      </Link>

      {/* Profile card */}
      <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-5 space-y-3">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-[#96321F]/10 flex items-center justify-center shrink-0">
            <span className="text-xl font-bold text-[#96321F]">
              {(profile.display_name ?? profile.email ?? '?')[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-[#242622]">{profile.full_name ?? profile.display_name ?? 'Unnamed'}</h1>
            {profile.display_name && profile.full_name && profile.display_name !== profile.full_name && (
              <p className="text-xs text-[#9E8F7E]">Goes by: {profile.display_name}</p>
            )}
            <p className="text-sm text-[#7E613F]">{profile.email}</p>
            {profile.phone && <p className="text-sm text-[#7E613F]">{profile.phone}</p>}
          </div>
          <span className="text-xs bg-[#EDE9DC] text-[#7E613F] px-2.5 py-1 rounded-full capitalize font-medium">
            {profile.tier ?? 'newcomer'}
          </span>
        </div>

        {/* Points breakdown */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="bg-[#F7F5EF] rounded-xl px-3 py-3 text-center">
            <p className="text-[10px] text-[#7E613F] mb-1 uppercase tracking-wide">App-Awarded</p>
            <p className="text-xl font-bold text-[#96321F]">{appAwarded.toLocaleString()}</p>
          </div>
          <div className="bg-[#F7F5EF] rounded-xl px-3 py-3 text-center">
            <p className="text-[10px] text-[#7E613F] mb-1 uppercase tracking-wide">From Toast</p>
            <p className="text-xl font-bold text-[#242622]">{fromToast.toLocaleString()}</p>
          </div>
          <div className="bg-[#96321F]/10 rounded-xl px-3 py-3 text-center">
            <p className="text-[10px] text-[#96321F] mb-1 uppercase tracking-wide">Total</p>
            <p className="text-xl font-bold text-[#96321F]">{balance.toLocaleString()}</p>
          </div>
        </div>

        {/* Toast POS reference (raw balance from Toast, for comparison) */}
        {toastPosBalance > 0 && (
          <div className="flex items-center justify-between text-xs text-[#9E8F7E] pt-1">
            <span>Toast POS balance: {toastPosBalance.toLocaleString()}</span>
            {lastToastVisit && (
              <span>
                Last Toast visit: {new Date(lastToastVisit).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Adjust points */}
      <section>
        <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-3">Adjust Points</h2>
        <AdjustPointsPanel
          userId={id}
          initialBalance={balance}
          customerLabel={profile.display_name ?? profile.full_name ?? profile.email ?? undefined}
        />
      </section>

      {/* Grant a reward */}
      <section>
        <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-3">Grant Reward</h2>
        <RedeemPanel
          userId={id}
          balance={balance}
          rewards={(rewards ?? []) as any}
        />
      </section>

      {/* Redemption history */}
      {(redemptions ?? []).length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-3">Redemption History</h2>
          <div className="space-y-2">
            {(redemptions ?? []).map((r: any) => (
              <div key={r.id} className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-xl">{r.rewards?.icon ?? '🎁'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#242622]">{r.rewards?.name ?? 'Reward'}</p>
                  {r.notes && <p className="text-xs text-[#9E8F7E] truncate">{r.notes}</p>}
                  <p className="text-xs text-[#9E8F7E]">
                    {r.status === 'redeemed'
                      ? `Redeemed ${r.redeemed_at ? new Date(r.redeemed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}`
                      : r.status === 'pending' ? 'Pending' : r.status}
                    {r.profiles?.display_name ? ` by ${r.profiles.display_name}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {r.rewards?.points_cost > 0 && (
                    <p className="text-sm font-bold text-red-500">−{r.rewards.points_cost} pts</p>
                  )}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    r.status === 'redeemed' ? 'bg-green-100 text-green-700' :
                    r.status === 'pending'  ? 'bg-yellow-100 text-yellow-700' :
                    'bg-[#F1F1E7] text-[#9E8F7E]'
                  }`}>
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent point activity */}
      <section>
        <h2 className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest mb-3">Recent Activity</h2>
        <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl overflow-hidden divide-y divide-[#F1F1E7]">
          {(recentEarns ?? []).length === 0 ? (
            <p className="text-xs text-[#9E8F7E] px-4 py-3">No activity yet</p>
          ) : (recentEarns ?? []).map((e: any) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1">
                <p className="text-xs text-[#242622]">{e.notes ?? (e.event_type ?? '').replace(/_/g, ' ')}</p>
                <p className="text-[10px] text-[#9E8F7E]">
                  {e.created_at ? new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                </p>
              </div>
              <p className={`text-sm font-bold ${e.points_delta >= 0 ? 'text-[#87A67F]' : 'text-red-500'}`}>
                {e.points_delta >= 0 ? '+' : ''}{e.points_delta} pts
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
