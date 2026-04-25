// ─────────────────────────────────────────────
// Changelog
//   v2026-04-25.1 — New page. Staff UI for sending push announcements (manual only).
// ─────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/server'
import AnnouncementForm from './AnnouncementForm'

export const dynamic = 'force-dynamic'

export default async function StaffAnnouncementsPage() {
  const service = createServiceClient()

  // Fetch recent send history + sender display name. Same separate-fetch
  // pattern as /staff/missions to dodge PostgREST FK cache flakiness on
  // freshly migrated tables.
  const { data: announcements } = await (service as any)
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(25)

  type SenderRow = { id: string; display_name: string | null; full_name: string | null }

  const senderIds = Array.from(
    new Set(((announcements ?? []) as any[]).map(a => a.sent_by).filter(Boolean))
  )
  let senders: SenderRow[] = []
  if (senderIds.length) {
    const { data } = await service
      .from('profiles')
      .select('id, display_name, full_name')
      .in('id', senderIds)
    senders = (data ?? []) as SenderRow[]
  }
  const senderMap = new Map<string, SenderRow>(senders.map(p => [p.id, p]))

  // Quick subscriber count for the form's "this will reach ~N people" hint.
  const { count: subscriberCount } = await service
    .from('push_subscriptions')
    .select('*', { count: 'exact', head: true })

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="font-display text-xl font-bold text-[#242622]">Announcements</h1>
        <p className="text-sm text-[#7E613F] mt-0.5">
          Send a one-time push notification to everyone who has the app installed.
          Manual sends only — nothing is automatic.
        </p>
      </div>

      <AnnouncementForm initialSubscriberCount={subscriberCount ?? 0} />

      <section className="space-y-2">
        <p className="text-xs font-semibold text-[#7E613F] uppercase tracking-wide">
          Recent · {(announcements ?? []).length}
        </p>

        {(announcements ?? []).length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-[#D4CFC3]">
            <p className="text-3xl mb-2">📣</p>
            <p className="font-semibold text-[#242622] mb-1">No announcements sent yet</p>
            <p className="text-sm text-[#7E613F]">When staff send a push, it will show up here.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {((announcements ?? []) as any[]).map(a => {
              const sender = a.sent_by ? senderMap.get(a.sent_by) : null
              const senderName = sender?.display_name || sender?.full_name || 'Unknown staff'
              return (
                <li
                  key={a.id}
                  className="bg-white border border-[#D4CFC3] rounded-2xl p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#242622] text-sm break-words">{a.title}</p>
                      <p className="text-sm text-[#7E613F] mt-0.5 break-words">{a.body}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-[#9E8F7E] flex-wrap">
                        <span>{formatWhen(a.created_at)}</span>
                        <span>·</span>
                        <span>by {senderName}</span>
                        <span>·</span>
                        <span className="font-mono text-[10px] text-[#7E613F] bg-[#F1F1E7] border border-[#D4CFC3] rounded px-1.5 py-0.5">
                          {a.url}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-[#242622]">
                        {a.sent_count}<span className="text-[#9E8F7E]"> / {a.subscriber_count}</span>
                      </p>
                      <p className="text-[10px] text-[#9E8F7E] uppercase tracking-wide">delivered</p>
                      {a.failed_count > 0 && (
                        <p className="text-[10px] text-[#96321F] mt-0.5">{a.failed_count} failed</p>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7)   return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
