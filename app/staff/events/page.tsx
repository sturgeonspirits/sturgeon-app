import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default async function StaffEventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff/login')

  const { data: eventTypes } = await supabase
    .from('event_types')
    .select('id, name, slug, icon, day_of_week, typical_time, description, is_active, sort_order')
    .order('sort_order')
    .order('name')

  const rows = eventTypes ?? []

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#242622]">Weekly Events</h1>
          <p className="text-sm text-[#7E613F] mt-0.5">
            Recurring events shown on the Events tab
          </p>
        </div>
        <Link
          href="/staff/events/new"
          className="bg-[#96321F] text-[#FFFFFF] text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#ae3a24] transition-colors"
        >
          + Add Event
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 bg-[#FFFFFF] rounded-2xl border border-[#D4CFC3]">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-semibold text-[#242622] mb-1">No weekly events yet</p>
          <p className="text-sm text-[#7E613F] mb-4">Add your recurring events like Trivia Night, Cribbage League, etc.</p>
          <Link
            href="/staff/events/new"
            className="inline-block bg-[#96321F] text-[#FFFFFF] font-bold px-5 py-2.5 rounded-xl hover:bg-[#ae3a24] transition-colors text-sm"
          >
            Add First Event
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(et => (
            <div
              key={et.id}
              className={`bg-[#FFFFFF] border rounded-xl px-4 py-3 flex items-center gap-4 ${et.is_active ? 'border-[#D4CFC3]' : 'border-[#D4CFC3] opacity-50'}`}
            >
              <span className="text-2xl shrink-0">{et.icon ?? '📅'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#242622] truncate">{et.name}</p>
                <p className="text-xs text-[#7E613F] mt-0.5">
                  {et.day_of_week != null ? `Every ${DAYS[et.day_of_week]}` : 'Day not set'}
                  {et.typical_time ? ` · ${et.typical_time}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!et.is_active && (
                  <span className="text-[10px] font-bold text-[#9E8F7E] bg-[#EDE9DC] px-2 py-0.5 rounded-full uppercase">
                    Hidden
                  </span>
                )}
                <Link
                  href={`/staff/events/${et.id}`}
                  className="text-xs bg-[#EDE9DC] text-[#7E613F] font-semibold px-3 py-1.5 rounded-lg hover:bg-[#D4CFC3] transition-colors"
                >
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
