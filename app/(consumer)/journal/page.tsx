import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { relativeTime } from '@/lib/utils'

export default async function JournalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: logs } = await supabase
    .from('tasting_logs')
    .select('*, spirits(name, category, is_house)')
    .eq('user_id', user.id)
    .order('visited_at', { ascending: false })
    .limit(50)

  const entries = logs ?? []

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="pt-4 flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Tasting Journal</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>
        <Link
          href="/journal/new"
          className="bg-[#f5c842] text-black text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#f5d060] transition-colors"
        >
          + Log
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🥃</p>
          <p className="text-white font-semibold mb-2">No entries yet</p>
          <p className="text-gray-500 text-sm mb-6">Log your first tasting to earn points</p>
          <Link
            href="/journal/new"
            className="bg-[#f5c842] text-black font-bold px-6 py-3 rounded-xl inline-block"
          >
            Log a Tasting
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(log => (
            <div key={log.id} className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="font-semibold text-white">
                    {log.spirits?.name ?? log.spirit_name ?? 'Unknown Spirit'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 capitalize">
                    {log.spirits?.category ?? log.spirit_category ?? ''}
                    {log.spirits?.is_house ? ' · House Spirit' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-3">
                  {log.rating && Array.from({ length: 5 }, (_, i) => (
                    <span key={i} className={i < log.rating ? 'text-[#f5c842]' : 'text-[#2e2e2e]'}>★</span>
                  ))}
                </div>
              </div>
              {log.overall_notes && (
                <p className="text-sm text-gray-400 leading-relaxed line-clamp-2">{log.overall_notes}</p>
              )}
              <p className="text-xs text-gray-600 mt-2">{relativeTime(log.visited_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
