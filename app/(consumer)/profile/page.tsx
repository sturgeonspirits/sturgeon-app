import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { tierLabel, tierColor, formatPoints, relativeTime } from '@/lib/utils'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: profile }, { data: ledger }, { data: recentEvents }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('points_ledger').select('*').eq('user_id', user.id).single(),
    supabase
      .from('earn_events')
      .select('event_type, points_delta, notes, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  async function handleSignOut() {
    'use server'
    const s = await createClient()
    await s.auth.signOut()
    redirect('/auth/login')
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div className="pt-4">
        <h1 className="text-xl font-bold text-white">Profile</h1>
      </div>

      {/* Member card */}
      <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-[#2e2e2e] flex items-center justify-center text-2xl">
            🐟
          </div>
          <div>
            <p className="font-bold text-white text-lg">{profile?.display_name ?? user.email}</p>
            <p className="text-sm font-medium" style={{ color: tierColor(profile?.tier ?? 'newcomer') }}>
              {tierLabel(profile?.tier ?? 'newcomer')}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#2e2e2e]">
          {[
            { label: 'Balance',  value: formatPoints(ledger?.balance ?? 0) + ' pts' },
            { label: 'Lifetime', value: formatPoints(ledger?.lifetime_earned ?? 0) + ' pts' },
            { label: 'Spent',    value: formatPoints(ledger?.lifetime_spent ?? 0) + ' pts' },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <p className="text-sm font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-600">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Points history */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Points History</h2>
        <div className="space-y-1">
          {(recentEvents ?? []).map((e, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-[#1e1e1e]">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{e.notes ?? e.event_type.replace('_', ' ')}</p>
                <p className="text-xs text-gray-600">{relativeTime(e.created_at)}</p>
              </div>
              <p className={`text-sm font-bold shrink-0 ${e.points_delta >= 0 ? 'text-[#5dbb5d]' : 'text-red-400'}`}>
                {e.points_delta >= 0 ? '+' : ''}{e.points_delta}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Sign out */}
      <form action={handleSignOut}>
        <button type="submit" className="w-full text-sm text-gray-600 hover:text-red-400 py-3 transition-colors">
          Sign out
        </button>
      </form>
    </div>
  )
}
