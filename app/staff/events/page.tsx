import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import EventScheduleManager from '@/components/staff/EventScheduleManager'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default async function StaffEventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const service = createServiceClient()

  // Load event types and their upcoming scheduled dates in parallel
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD

  const [{ data: eventTypes }, { data: upcomingEvents }] = await Promise.all([
    service
      .from('event_types')
      .select('id, name, slug, icon, day_of_week, typical_time, schedule_label, description, is_active, sort_order')
      .order('sort_order')
      .order('name'),
    service
      .from('events')
      .select('id, event_type_id, event_date, start_time, notes, is_cancelled')
      .gte('event_date', today)
      .eq('is_cancelled', false)
      .order('event_date'),
  ])

  const rows = eventTypes ?? []

  // Group upcoming events by event_type_id
  const eventsByType: Record<string, typeof upcomingEvents> = {}
  for (const ev of (upcomingEvents ?? [])) {
    if (!eventsByType[ev.event_type_id]) eventsByType[ev.event_type_id] = []
    eventsByType[ev.event_type_id]!.push(ev)
  }

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#242622]">Events</h1>
          <p className="text-sm text-[#7E613F] mt-0.5">
            Manage recurring events and schedule specific dates
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
          <p className="font-semibold text-[#242622] mb-1">No events yet</p>
          <p className="text-sm text-[#7E613F] mb-4">Add your recurring events like Trivia Night, Cribbage League, etc.</p>
          <Link
            href="/staff/events/new"
            className="inline-block bg-[#96321F] text-[#FFFFFF] font-bold px-5 py-2.5 rounded-xl hover:bg-[#ae3a24] transition-colors text-sm"
          >
            Add First Event
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(et => {
            const dates = eventsByType[et.id] ?? []
            return (
              <div
                key={et.id}
                className={`bg-[#FFFFFF] border rounded-xl px-4 py-3 ${et.is_active ? 'border-[#D4CFC3]' : 'border-[#D4CFC3] opacity-50'}`}
              >
                {/* Header row */}
                <div className="flex items-center gap-4">
                  <span className="text-2xl shrink-0">{et.icon ?? '📅'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#242622] truncate">{et.name}</p>
                    <p className="text-xs text-[#7E613F] mt-0.5">
                      {dates.length > 0
                        ? `Next: ${new Date(dates[0]!.event_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
                        : et.schedule_label ?? 'No upcoming dates'}
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

                {/* Upcoming dates + scheduler */}
                <div className="mt-2 border-t border-[#F1F1E7] pt-2">
                  <EventScheduleManager
                    eventTypeId={et.id}
                    upcomingEvents={dates}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
