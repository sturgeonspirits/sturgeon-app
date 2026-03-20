import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function StaffDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff/login')

  // Recent member activity
  const { data: recentEvents } = await supabase
    .from('earn_events')
    .select('*, profiles(display_name)')
    .order('created_at', { ascending: false })
    .limit(10)

  // Pending reward redemptions
  const { data: pending } = await supabase
    .from('reward_redemptions')
    .select('*, profiles(display_name), rewards(name, icon, reward_value)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const { data: profile } = await supabase.from('profiles').select('display_name, role').eq('id', user.id).single()

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-xl font-bold text-[#F1F1E7]">Dashboard</h1>
        <p className="text-sm text-[#7a6e5f]">
          Welcome, {profile?.display_name ?? 'staff'} · <span className="text-[#96321F]">{profile?.role}</span>
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { href: '/staff/scores',   icon: '🏆', label: 'Enter Scores',  desc: 'Cribbage & Trivia' },
          { href: '/staff/missions', icon: '📋', label: 'Missions',      desc: 'Mark completions'  },
        ].map(card => (
          <Link key={card.href} href={card.href}
            className="bg-[#161410] border border-[#2c2820] rounded-xl p-4 hover:border-[#96321F]/30 transition-colors">
            <p className="text-2xl mb-2">{card.icon}</p>
            <p className="font-semibold text-[#F1F1E7] text-sm">{card.label}</p>
            <p className="text-xs text-[#7a6e5f] mt-0.5">{card.desc}</p>
          </Link>
        ))}
      </div>

      {/* Pending redemptions */}
      {(pending ?? []).length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[#7a6e5f] uppercase tracking-widest mb-3">
            Pending Rewards ({pending!.length})
          </h2>
          <div className="space-y-2">
            {pending!.map(r => (
              <div key={r.id} className="bg-[#161410] border border-[#96321F]/20 rounded-xl p-3 flex items-center gap-3">
                <span className="text-xl">{(r.rewards as any)?.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#F1F1E7]">{(r.rewards as any)?.name}</p>
                  <p className="text-xs text-[#7a6e5f]">
                    {(r.profiles as any)?.display_name} · {(r.rewards as any)?.reward_value}
                  </p>
                </div>
                <RedeemButton redemptionId={r.id} staffId={user.id} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent activity */}
      <section>
        <h2 className="text-xs font-semibold text-[#7a6e5f] uppercase tracking-widest mb-3">Recent Activity</h2>
        <div className="space-y-1">
          {(recentEvents ?? []).map(e => (
            <div key={e.id} className="flex items-center gap-3 py-2 border-b border-[#1e1b16]">
              <div className="flex-1">
                <p className="text-sm text-[#F1F1E7]">{(e.profiles as any)?.display_name ?? 'Unknown'}</p>
                <p className="text-xs text-[#7a6e5f]">{e.event_type.replace('_', ' ')}</p>
              </div>
              <p className={`text-sm font-bold ${e.points_delta >= 0 ? 'text-[#87A67F]' : 'text-red-400'}`}>
                {e.points_delta >= 0 ? '+' : ''}{e.points_delta} pts
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// Client component for the redeem button
function RedeemButton({ redemptionId, staffId }: { redemptionId: string; staffId: string }) {
  return (
    <form action={`/api/staff/redeem`} method="POST">
      <input type="hidden" name="redemptionId" value={redemptionId} />
      <input type="hidden" name="staffId"      value={staffId} />
      <button type="submit"
        className="bg-[#96321F] text-[#F1F1E7] text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#ae3a24] transition-colors">
        Redeem
      </button>
    </form>
  )
}
