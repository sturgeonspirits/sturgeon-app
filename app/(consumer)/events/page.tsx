import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const FB_ENDPOINT = 'https://snazzy-daffodil-868c13.netlify.app/.netlify/functions/fb-events'

interface FbEvent {
  name:                  string
  start_time:            string
  end_time?:             string
  venue?:                string
  place?:                string
  description?:          string
  cover?:                string
  is_recurring_instance?: boolean
}

const TZ = 'America/Chicago'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    timeZone: TZ,
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
    timeZone: TZ,
  })
}

function truncate(text: string | undefined, max = 220) {
  const t = (text ?? '').trim()
  if (!t) return ''
  return t.length > max ? t.slice(0, max).replace(/\s+\S*$/, '') + '…' : t
}

async function fetchFbEvents(): Promise<FbEvent[]> {
  try {
    const res = await fetch(FB_ENDPOINT, { next: { revalidate: 300 } })
    if (!res.ok) return []
    const data = await res.json()
    if (!data?.ok || !Array.isArray(data.events)) return []
    return data.events
  } catch {
    return []
  }
}

// ── Sub-components ────────────────────────────────────────

function EventCard({ ev, featured = false }: { ev: FbEvent; featured?: boolean }) {
  const venue = ev.venue || ev.place || ''
  const desc  = truncate(ev.description, 220)

  return (
    <div className={`bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl overflow-hidden ${featured ? '' : ''}`}>
      {/* Cover */}
      {ev.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ev.cover}
          alt={ev.name}
          className="w-full aspect-video object-cover"
        />
      ) : (
        <div className="w-full aspect-video bg-[#EDE9DC] flex items-center justify-center">
          <span className="text-5xl opacity-20">🥃</span>
        </div>
      )}

      {/* Body */}
      <div className="p-4 space-y-2">
        {/* Title + recurring pill */}
        <div className="flex items-start justify-between gap-3">
          <p className={`font-bold text-[#242622] leading-snug ${featured ? 'text-lg' : 'text-sm'}`}>
            {ev.name}
          </p>
          {ev.is_recurring_instance && (
            <span className="shrink-0 text-[10px] font-bold text-[#7E613F] border border-[#C8BCA4] px-2 py-0.5 rounded-full">
              Recurring
            </span>
          )}
        </div>

        {/* Date / time */}
        {ev.start_time && (
          <div className="flex items-center gap-1.5">
            <svg className="text-[#96321F] shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span className="text-xs font-semibold text-[#96321F]">
              {fmtDate(ev.start_time)} · {fmtTime(ev.start_time)}
              {ev.end_time ? ` – ${fmtTime(ev.end_time)}` : ''}
            </span>
          </div>
        )}

        {/* Venue */}
        {venue && (
          <div className="flex items-center gap-1.5">
            <svg className="text-[#7E613F] shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5"/>
            </svg>
            <span className="text-xs text-[#7E613F]">{venue}</span>
          </div>
        )}

        {/* Description */}
        {desc && (
          <p className="text-xs text-[#9E8F7E] leading-relaxed pt-1">{desc}</p>
        )}
      </div>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <p className="text-xs font-bold text-[#96321F] uppercase tracking-[0.18em]">{label}</p>
      <div className="flex-1 h-px bg-[#D4CFC3]" />
    </div>
  )
}

// ── Format a DB event date ────────────────────────────────

function fmtDbDate(dateStr: string, timeStr?: string | null) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const datePart = d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
  if (!timeStr) return datePart
  const [h, m] = timeStr.split(':').map(Number)
  const t = new Date(year, month - 1, day, h, m)
  const timePart = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${datePart} · ${timePart}`
}

// ── Page ──────────────────────────────────────────────────

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const service = createServiceClient()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

  const [fbEvents, { data: eventTypes }, { data: scheduledEventsRaw }, { data: openPeriods }] = await Promise.all([
    fetchFbEvents(),
    service
      .from('event_types')
      .select('id, name, slug, icon, day_of_week, typical_time, description, participant_type')
      .eq('is_active', true)
      .order('sort_order'),
    service
      .from('events')
      .select('id, event_type_id, event_date, start_time, notes, is_cancelled')
      .gte('event_date', today)
      .eq('is_cancelled', false)
      .order('event_date')
      .limit(20),
    // Fetch upcoming open leaderboard periods — match by event_id (most reliable)
    // Also fall back to event_type_id+date for older periods without event_id
    // Note: no embedded join to event_types — we already fetched event_types above
    service
      .from('leaderboard_periods')
      .select('id, event_id, event_type_id, starts_at')
      .eq('is_finalized', false)
      .eq('period_type', 'single_night')
      .order('starts_at')
      .limit(40),
  ])

  // Build lookup maps for period matching — include all event types (cribbage, trivia, etc.)
  const periodByEventId      = new Map<string, string>() // event.id     -> period.id
  const periodByTypeAndDate  = new Map<string, string>() // typeId::date -> period.id
  for (const p of (openPeriods ?? [])) {
    if ((p as any).event_id) {
      periodByEventId.set((p as any).event_id, p.id)
    }
    const dateKey = new Date(p.starts_at).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
    if (dateKey >= today) {
      periodByTypeAndDate.set(`${p.event_type_id}::${dateKey}`, p.id)
    }
  }

  // Join event_types in code so we're not reliant on PostgREST FK cache
  const etById = Object.fromEntries((eventTypes ?? []).map((et: any) => [et.id, et]))
  const dbEvents = (scheduledEventsRaw ?? [])
    .map((ev: any) => {
      const et = etById[ev.event_type_id] ?? null
      // Prefer event_id match, fall back to type+date
      const periodId = periodByEventId.get(ev.id)
        ?? periodByTypeAndDate.get(`${ev.event_type_id}::${ev.event_date}`)
        ?? null
      return { ...ev, event_type: et, period: periodId ? { id: periodId } : null }
    })
    .filter((ev: any) => ev.event_type !== null)

  const featured = fbEvents[0] ?? null
  const rest     = fbEvents.slice(1)

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="max-w-lg mx-auto px-4 pb-10">
      <div className="pt-10 mb-6">
        <h1 className="font-display text-2xl font-bold text-[#242622] uppercase tracking-wide">
          Events
        </h1>
        <p className="text-sm text-[#7E613F] mt-1">Upcoming happenings at Sturgeon Spirits</p>
      </div>

      {/* ── Scheduled specific dates (from DB) ───────────── */}
      {dbEvents.length > 0 && (
        <section className="mb-8">
          <SectionHeader label="Upcoming" />
          <div className="space-y-2">
            {dbEvents.map((ev: any) => {
              const et = ev.event_type as any
              if (!et) return null
              return (
                <div
                  key={ev.id}
                  className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#96321F]/10 border border-[#96321F]/20 flex items-center justify-center text-2xl shrink-0">
                      {et.icon ?? '📅'}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-[#242622]">{et.name}</p>
                      <p className="text-xs font-semibold text-[#96321F] mt-0.5">
                        {fmtDbDate(ev.event_date, ev.start_time)}
                      </p>
                      {ev.notes && (
                        <p className="text-xs text-[#9E8F7E] mt-0.5">{ev.notes}</p>
                      )}
                    </div>
                  </div>
                  {/*
                    Sign-up button logic:
                    - Individual events (cribbage): show for any upcoming event. Route by
                      eventId so the sign-up page can find/create the period automatically.
                    - Team events (trivia): only show when a period already exists, because
                      teams form within that period. Route by periodId.
                  */}
                  {et.participant_type === 'individual' ? (
                    <Link
                      href={`/events/event/${ev.id}/signup`}
                      className="mt-3 w-full flex items-center justify-center gap-2 bg-[#96321F] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#ae3a24] active:scale-[0.98] transition-all"
                    >
                      Sign Up for This Night
                    </Link>
                  ) : ev.period ? (
                    <Link
                      href={`/events/${ev.period.id}/signup`}
                      className="mt-3 w-full flex items-center justify-center gap-2 bg-[#96321F] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#ae3a24] active:scale-[0.98] transition-all"
                    >
                      Sign Up for This Night
                    </Link>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Facebook events ───────────────────────────────── */}
      {fbEvents.length > 0 && (
        <>
          {/* ── Next up (featured) ───────────────────────── */}
          <section className="mb-8">
            <SectionHeader label="From Facebook" />
            {featured && <EventCard ev={featured} featured />}
            {rest.length > 0 && (
              <div className="space-y-3 mt-3">
                {rest.map((ev, i) => (
                  <EventCard key={i} ev={ev} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ── No events fallback ───────────────────────────── */}
      {dbEvents.length === 0 && fbEvents.length === 0 && (
        <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-6 text-center mb-8">
          <p className="text-3xl mb-2">📅</p>
          <p className="text-sm font-semibold text-[#242622]">No upcoming events right now</p>
          <p className="text-xs text-[#7E613F] mt-1">Check back soon — we update this regularly</p>
        </div>
      )}

      {/* ── Weekly recurring (from DB) ───────────────────── */}
      {(eventTypes ?? []).length > 0 && (
        <section className="mb-8">
          <SectionHeader label="Every Week" />
          <div className="space-y-2">
            {(eventTypes ?? []).map((et: any) => (
              <Link
                key={et.id}
                href={`/leaderboards/${et.slug ?? '#'}`}
                className="flex items-center gap-4 bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 hover:border-[#C8BCA4] transition-colors active:scale-[0.99]"
              >
                <div className="w-12 h-12 rounded-xl bg-[#96321F]/10 border border-[#96321F]/20 flex items-center justify-center text-2xl shrink-0">
                  {et.icon}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#242622]">{et.name}</p>
                  <p className="text-xs text-[#7E613F] mt-0.5">
                    {et.schedule_label
                      ? et.schedule_label
                      : et.day_of_week != null ? `Every ${DAYS[et.day_of_week]}` : ''}
                    {et.typical_time ? ` · ${et.typical_time}` : ''}
                  </p>
                  {et.description && (
                    <p className="text-xs text-[#9E8F7E] mt-1">{et.description}</p>
                  )}
                </div>
                <span className="text-[#C8BCA4] text-lg">›</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Coming soon ──────────────────────────────────── */}
      <section>
        <SectionHeader label="Coming Soon" />
        <div className="space-y-2">
          {[
            { icon: '🎟️', label: 'RSVP & Tickets', desc: 'Reserve your spot at ticketed events' },
            { icon: '📍', label: 'QR Check-In',     desc: 'Scan at the bar to earn points'       },
          ].map(item => (
            <div
              key={item.label}
              className="flex items-center gap-4 bg-[#FFFFFF] border border-[#D4CFC3]/60 rounded-2xl p-4 opacity-55"
            >
              <div className="w-12 h-12 rounded-xl bg-[#EDE9DC] flex items-center justify-center text-2xl shrink-0">
                {item.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-[#242622]">{item.label}</p>
                  <span className="text-[10px] font-bold text-[#9E8F7E] bg-[#EDE9DC] px-2 py-0.5 rounded-full uppercase tracking-wide">
                    Soon
                  </span>
                </div>
                <p className="text-xs text-[#9E8F7E] mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
