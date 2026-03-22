import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const FB_ENDPOINT = 'https://snazzy-daffodil-868c13.netlify.app/.netlify/functions/fb-events'
const SEE_MORE_URL = 'https://sturgeonspirits.com/upcoming-events'

interface FbEvent {
  name:       string
  start_time: string
  venue?:     string
  place?:     string
  url?:       string
  cover?:     string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  })
}

async function fetchFbEvents(): Promise<FbEvent[]> {
  try {
    const res = await fetch(FB_ENDPOINT, { next: { revalidate: 300 } }) // cache 5 min
    if (!res.ok) return []
    const data = await res.json()
    if (!data?.ok || !Array.isArray(data.events)) return []
    return data.events
  } catch {
    return []
  }
}

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

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="max-w-lg mx-auto px-4 pb-10">
      <div className="pt-10 mb-6">
        <h1 className="font-display text-2xl font-bold text-[#242622] uppercase tracking-wide">
          Events
        </h1>
        <p className="text-sm text-[#7E613F] mt-1">What's happening at Sturgeon Spirits</p>
      </div>

      {/* ── Upcoming events from Facebook feed ─────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 flex-1">
            <p className="text-xs font-bold text-[#96321F] uppercase tracking-[0.18em]">Upcoming</p>
            <div className="flex-1 h-px bg-[#D4CFC3]" />
          </div>
          <a
            href={SEE_MORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-[#96321F] hover:underline ml-3 shrink-0"
          >
            See all →
          </a>
        </div>

        {fbEvents.length === 0 ? (
          <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-6 text-center">
            <p className="text-3xl mb-2">📅</p>
            <p className="text-sm font-semibold text-[#242622]">No upcoming events right now</p>
            <p className="text-xs text-[#7E613F] mt-1">Check back soon or follow us on Facebook</p>
          </div>
        ) : (
          <div className="space-y-3">
            {fbEvents.map((ev, i) => {
              const venue = ev.venue || ev.place || ''
              return (
                <a
                  key={i}
                  href={ev.url ?? SEE_MORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl overflow-hidden hover:border-[#C8BCA4] active:scale-[0.99] transition-all"
                >
                  {/* Cover image */}
                  {ev.cover ? (
                    <div
                      className="w-full aspect-video bg-cover bg-center bg-no-repeat"
                      style={{ backgroundImage: `url('${ev.cover}')` }}
                    />
                  ) : (
                    <div className="w-full aspect-video bg-[#EDE9DC] flex items-center justify-center">
                      <span className="text-4xl opacity-30">🥃</span>
                    </div>
                  )}

                  {/* Body */}
                  <div className="p-4">
                    <p className="font-bold text-[#242622] leading-snug">{ev.name}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5">
                      {ev.start_time && (
                        <span className="text-xs text-[#96321F] font-semibold">
                          {fmtDate(ev.start_time)} · {fmtTime(ev.start_time)}
                        </span>
                      )}
                      {venue && (
                        <span className="text-xs text-[#7E613F]">{venue}</span>
                      )}
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Weekly recurring events (from DB) ──────────────── */}
      {(eventTypes ?? []).length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-xs font-bold text-[#96321F] uppercase tracking-[0.18em]">Weekly</p>
            <div className="flex-1 h-px bg-[#D4CFC3]" />
          </div>
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

      {/* ── Coming soon ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <p className="text-xs font-bold text-[#96321F] uppercase tracking-[0.18em]">Coming Soon</p>
          <div className="flex-1 h-px bg-[#D4CFC3]" />
        </div>
        <div className="space-y-2">
          {[
            { icon: '🎟️', label: 'RSVP & Tickets',  desc: 'Reserve your spot at ticketed events' },
            { icon: '📍', label: 'QR Check-In',      desc: 'Scan at the bar to earn points' },
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
