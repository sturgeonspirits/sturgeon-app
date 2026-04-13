import { getAuthUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import JournalSearch from '@/components/journal/JournalSearch'

export default async function JournalPage() {
  const { supabase, user } = await getAuthUser()
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
      <div className="pt-4 flex items-center justify-between mb-5">
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
        <JournalSearch entries={entries} />
      )}
    </div>
  )
}
