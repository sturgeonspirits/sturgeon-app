import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import IndividualSignupForm from '@/components/events/IndividualSignupForm'

interface Props { params: Promise<{ eventId: string }> }

// Helper: build noon-Chicago ISO string for a YYYY-MM-DD date string
function chicagoNoonISO(eventDate: string): string {
  const chicagoNoon = new Date(`${eventDate}T12:00:00`)
  const offsetMs =
    new Date(chicagoNoon.toLocaleString('en-US', { timeZone: 'America/Chicago' })).getTime() -
    new Date(chicagoNoon.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()
  return new Date(chicagoNoon.getTime() - offsetMs).toISOString()
}

export default async function EventSignupPage({ params }: Props) {
  const { eventId } = await params

  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/auth/login')

  const service = createServiceClient()

  // 1. Fetch the scheduled event + its event type (separate queries to avoid
  //    relying on PostgREST FK schema cache, which can go stale after DDL changes)
  const { data: event } = await service
    .from('events')
    .select('id, event_date, start_time, notes, is_cancelled, event_type_id')
    .eq('id', eventId)
    .maybeSingle()

  if (!event || event.is_cancelled) redirect('/events')

  const { data: et } = await service
    .from('event_types')
    .select('name, icon, slug, participant_type')
    .eq('id', event.event_type_id)
    .maybeSingle()

  // This route is only for individual events. Team events use period-based routing.
  if (!et || et.participant_type !== 'individual') redirect('/events')

  const todayChicago = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  if (event.event_date < todayChicago) redirect('/events')

  // 2. Find existing period for this event, or create one on the fly.
  //    The period should already exist (auto-created by /api/staff/event), but we
  //    create it here as a safety net so sign-ups never silently fail.
  // Use limit(1) + order by created_at so we always get the OLDEST period
  // for this event (the one staff created first) rather than crashing when
  // multiple periods happen to share the same event_id.
  const { data: periods } = await service
    .from('leaderboard_periods')
    .select('id, is_finalized')
    .eq('event_id', eventId)
    .eq('is_finalized', false)
    .order('created_at', { ascending: true })
    .limit(1)

  let period: { id: string; is_finalized: boolean } | null = (periods ?? [])[0] ?? null

  if (!period) {
    // Auto-create the period so the sign-up can proceed
    const [year, month, day] = event.event_date.split('-').map(Number)
    const label = new Date(year, month - 1, day).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })
    const startsAt = chicagoNoonISO(event.event_date)

    const { data: created } = await service
      .from('leaderboard_periods')
      .insert({
        event_type_id: event.event_type_id,
        event_id:      eventId,
        label,
        period_type:   'single_night',
        starts_at:     startsAt,
        is_finalized:  false,
      })
      .select('id, is_finalized')
      .single()

    period = created
  }

  if (!period) {
    // Something went badly wrong creating the period — bounce back to events
    redirect('/events')
  }

  // 3. Check if the user is already registered
  const { data: existing } = await service
    .from('leaderboard_events')
    .select('id')
    .eq('period_id', period.id)
    .eq('user_id', user.id)
    .maybeSingle()

  const isRegistered = !!existing

  // 4. Format the display date
  const [y, mo, d] = event.event_date.split('-').map(Number)
  const eventDate = new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-[#F5F2EC]">
      <div className="max-w-lg mx-auto px-4 py-8 pb-28">
        <Link
          href="/events"
          className="inline-flex items-center gap-1.5 text-sm text-[#7E613F] hover:text-[#96321F] transition-colors mb-6"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to Events
        </Link>

        <IndividualSignupForm
          periodId={period.id}
          eventName={et.name}
          eventIcon={et.icon ?? '🎮'}
          eventDate={eventDate}
          isRegistered={isRegistered}
        />
      </div>
    </div>
  )
}
