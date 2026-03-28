import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { dayOfWeekLabel } from '@/lib/utils'

export default async function LeaderboardsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: eventTypes } = await supabase
    .from('event_types')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  const events = eventTypes ?? []

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <div className="pt-4">
        <h1 className="font-display text-xl font-bold text-[#242622]">Standings</h1>
        <p className="text-sm text-[#7E613F] mt-1">Weekly leaderboards & all-time records</p>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 bg-[#FFFFFF] rounded-2xl border border-[#D4CFC3]">
          <p className="text-5xl mb-4">🥃</p>
          <p className="font-semibold text-[#242622] mb-1">Leaderboards coming soon</p>
          <p className="text-sm text-[#7E613F] px-6">
            Staff will set up event boards for Cribbage Night, Trivia, and more. Check back after your first event!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(et => (
            <Link
              key={et.id}
              href={`/leaderboards/${et.slug}`}
              className="block bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 hover:border-[#C8BCA4] transition-colors active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                  style={{ backgroundColor: '#96321F15', border: '1px solid #96321F30' }}
                >
                  {et.icon}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#242622]">{et.name}</p>
                  <p className="text-xs text-[#7E613F] mt-0.5">
                    {et.schedule_label
                      ? et.schedule_label
                      : et.day_of_week != null ? `${dayOfWeekLabel(et.day_of_week)}s` : ''}
                    {et.typical_time ? ` · ${et.typical_time}` : ''}
                    {et.participant_type ? ` · ${et.participant_type}` : ''}
                  </p>
                  {et.description && (
                    <p className="text-xs text-[#9E8F7E] mt-0.5">{et.description}</p>
                  )}
                </div>
                <span className="text-[#9E8F7E] text-lg">›</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-[#9E8F7E] text-center pt-2">
        You don't have to play to watch — all standings are public
      </p>
    </div>
  )
}
