import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TierProgress from '@/components/club/TierProgress'
import MissionGrid from '@/components/club/MissionGrid'
import PointsBadge from '@/components/club/PointsBadge'

export default async function ClubPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Parallel fetch everything needed for the Club page
  const [profileRes, ledgerRes, missionsRes, completionsRes, challengesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('points_ledger').select('*').eq('user_id', user.id).single(),
    supabase.from('missions').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('mission_completions').select('mission_id, completed_at').eq('user_id', user.id),
    supabase.from('challenges').select('*, challenge_missions(mission_id)').eq('is_active', true).order('sort_order'),
  ])

  const profile     = profileRes.data
  const ledger      = ledgerRes.data
  const missions    = missionsRes.data ?? []
  const completions = completionsRes.data ?? []
  const challenges  = challengesRes.data ?? []

  // Build a set of completed mission IDs for fast lookup
  const completedIds = new Set(completions.map(c => c.mission_id))

  // Tier thresholds for progress bar
  const { data: tiers } = await supabase.from('tier_thresholds').select('*').order('min_lifetime')

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="pt-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">
            {profile?.display_name ? `Hey, ${profile.display_name.split(' ')[0]}` : 'Spearers Club'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Welcome back</p>
        </div>
        <PointsBadge balance={ledger?.balance ?? 0} tier={profile?.tier ?? 'newcomer'} />
      </div>

      {/* Tier progress */}
      {tiers && profile && ledger && (
        <TierProgress
          currentTier={profile.tier}
          lifetimeEarned={ledger.lifetime_earned}
          tiers={tiers}
        />
      )}

      {/* Active challenges */}
      {challenges.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Challenges</h2>
          <div className="space-y-2">
            {challenges.map(challenge => {
              const required = (challenge.challenge_missions as { mission_id: string }[]) ?? []
              const done     = required.filter(cm => completedIds.has(cm.mission_id)).length
              const pct      = required.length ? Math.round((done / required.length) * 100) : 0
              return (
                <div key={challenge.id} className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{challenge.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-white">{challenge.title}</p>
                        <p className="text-xs text-gray-500">{challenge.description}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#f5c842]">+{challenge.bonus_points}pts</span>
                  </div>
                  <div className="h-1.5 bg-[#2e2e2e] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#f5c842] rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{done}/{required.length} missions</p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Missions */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Missions</h2>
        <MissionGrid missions={missions} completedIds={completedIds} userId={user.id} />
      </section>
    </div>
  )
}
