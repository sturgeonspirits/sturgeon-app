import { createClient } from '@/lib/supabase/server'
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
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

// ── Page ──────────────────────────────────────────────────

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [fbEvents, { data: eventTypes }] = await Promise.all([
    fetchFbEvents(),
    supabase
      .from('event_types')
      .select('id, name, slug, icon, day_of_week, typical_time, description')
      .eq('is_active', true)
      .order('sort_order'),
  ])

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

      {fbEvents.length === 0 ? (
        <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-6 text-center mb-8">
          <p className="text-3xl mb-2">📅</p>
          <p className="text-sm font-semibold text-[#242622]">No upcoming events right now</p>
          <p className="text-xs text-[#7E613F] mt-1">Check back soon — we update this regularly</p>
        </div>
      ) : (
        <>
          {/* ── Next up (featured) ───────────────────────── */}
          <section className="mb-8">
            <SectionHeader label="Next Up" />
            {featured && <EventCard ev={featured} featured />}
          </section>

          {/* ── All upcoming ─────────────────────────────── */}
          {rest.length > 0 && (
            <section className="mb-8">
              <SectionHeader label="All Upcoming" />
              <div className="space-y-3">
                {rest.map((ev, i) => (
                  <EventCard key={i} ev={ev} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── Weekly recurring (from DB) ───────────────────── */}
      {(eventTypes ?? []).length > 0 && (
        <section className="mb-8">
          <SectionHeader label="Every Week" />
          <div className="space-y-2">
            {(eventTypes ?? []).map(et => (
              <Link
                key={et.id}
                href={`/leaderboards/${(et as any).slug ?? '#'}`}
                className="flex items-center gap-4 bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 hover:border-[#C8BCA4] transition-colors active:scale-[0.99]"
              >
                <div className="w-12 h-12 rounded-xl bg-[#96321F]/10 border border-[#96321F]/20 flex items-center justify-center text-2xl shrink-0">
                  {et.icon}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#242622]">{et.name}</p>
                  <p className="text-xs text-[#7E613F] mt-0.5">
                    {et.day_of_week != null ? `Every ${DAYS[et.day_of_week]}` : ''}
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
