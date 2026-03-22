import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { relativeTime } from '@/lib/utils'
import DeleteEntryButton from '@/components/journal/DeleteEntryButton'

export default async function JournalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: logs } = await supabase
    .from('tasting_logs')
    .select('id, spirit_name, spirit_category, overall_notes, rating, visited_at')
    .eq('user_id', user.id)
    .order('visited_at', { ascending: false })
    .limit(50)

  const entries = logs ?? []

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="pt-4 flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-bold text-[#242622]">Tasting Journal</h1>
          <p className="text-sm text-[#7E613F] mt-0.5">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>
        <Link
          href="/journal/new"
          className="bg-[#96321F] text-[#FFFFFF] text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#ae3a24] transition-colors"
        >
          + Log
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🥃</p>
          <p className="text-[#242622] font-semibold mb-2">No entries yet</p>
          <p className="text-[#7E613F] text-sm mb-6">Log your first tasting to earn points</p>
          <Link
            href="/journal/new"
            className="bg-[#96321F] text-[#FFFFFF] font-bold px-6 py-3 rounded-xl inline-block hover:bg-[#ae3a24] transition-colors"
          >
            Log a Tasting
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(log => (
            <div key={log.id} className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="font-semibold text-[#242622]">
                    {log.spirit_name ?? 'Unknown'}
                  </p>
                  <p className="text-xs text-[#7E613F] mt-0.5 capitalize">
                    {log.spirit_category ?? ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-3 shrink-0">
                  {log.rating && (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <span key={i} className={i < log.rating ? 'text-[#96321F]' : 'text-[#D4CFC3]'}>★</span>
                      ))}
                    </div>
                  )}
                  <DeleteEntryButton logId={log.id} />
                </div>
              </div>
              {log.overall_notes && (
                <p className="text-sm text-[#7E613F] leading-relaxed line-clamp-2">{log.overall_notes}</p>
              )}
              <p className="text-xs text-[#9E8F7E] mt-2">{relativeTime(log.visited_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
