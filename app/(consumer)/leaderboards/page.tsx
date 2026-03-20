import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { dayOfWeekLabel } from '@/lib/utils'

export default async function LeaderboardsPage() {
  const supabase = await createClient()

  const { data: eventTypes } = await supabase
    .from('event_types')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <div className="pt-4">
        <h1 className="font-display text-xl font-bold text-[#F1F1E7]">Leaderboards</h1>
        <p className="text-sm text-[#7a6e5f] mt-1">Weekly standings & all-time records</p>
      </div>

      <div className="space-y-3">
        {(eventTypes ?? []).map(et => (
          <Link
            key={et.id}
            href={`/leaderboards/${et.slug}`}
            className="block bg-[#161410] border border-[#2c2820] rounded-2xl p-4 hover:border-[#3a3228] transition-colors active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                style={{ backgroundColor: '#96321F15', border: '1px solid #96321F30' }}
              >
                {et.icon}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-[#F1F1E7]">{et.name}</p>
                <p className="text-xs text-[#7a6e5f] mt-0.5">
                  {et.day_of_week != null ? `${dayOfWeekLabel(et.day_of_week)}s` : ''}
                  {et.typical_time ? ` · ${et.typical_time}` : ''}
                  {' · '}
                  <span className="capitalize">{et.participant_type}</span>
                </p>
              </div>
              <span className="text-[#3a3228] text-lg">›</span>
            </div>
          </Link>
        ))}
      </div>

      <p className="text-xs text-[#2c2820] text-center pt-2">
        New events appear here automatically when added by staff
      </p>
    </div>
  )
}
