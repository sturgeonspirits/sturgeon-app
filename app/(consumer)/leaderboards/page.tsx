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
        <h1 className="text-xl font-bold text-white">Leaderboards</h1>
        <p className="text-sm text-gray-500 mt-1">Weekly standings & all-time records</p>
      </div>

      <div className="space-y-3">
        {(eventTypes ?? []).map(et => (
          <Link
            key={et.id}
            href={`/leaderboards/${et.slug}`}
            className="block bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-4 hover:border-[#3e3e3e] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: `${et.color}20`, border: `1px solid ${et.color}40` }}
              >
                {et.icon}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-white">{et.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {et.day_of_week != null ? `${dayOfWeekLabel(et.day_of_week)}s` : ''}
                  {et.typical_time ? ` · ${et.typical_time}` : ''}
                  {' · '}
                  <span className="capitalize">{et.participant_type}</span>
                </p>
              </div>
              <span className="text-gray-600 text-lg">›</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Placeholder for future activities */}
      <p className="text-xs text-gray-700 text-center pt-2">
        New events appear here automatically when added by staff
      </p>
    </div>
  )
}
