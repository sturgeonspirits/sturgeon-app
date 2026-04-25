// ─────────────────────────────────────────────
// Changelog
//   v2026-04-25.1 — New component. Staff-facing form to compose + send a push announcement.
// ─────────────────────────────────────────────

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const TITLE_MAX = 120
const BODY_MAX  = 400

const QUICK_DESTINATIONS: { label: string; url: string }[] = [
  { label: 'Home',         url: '/club'         },
  { label: 'Events',       url: '/events'       },
  { label: 'Rewards',      url: '/rewards'      },
  { label: 'Leaderboards', url: '/leaderboards' },
  { label: 'Journal',      url: '/journal'      },
]

type SendResult = {
  ok: boolean
  logged?: boolean
  logError?: string
  subscriberCount?: number
  sent?: number
  failed?: number
  expired?: number
  error?: string
}

export default function AnnouncementForm({
  initialSubscriberCount,
}: {
  initialSubscriberCount: number
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [title, setTitle] = useState('')
  const [body,  setBody]  = useState('')
  const [url,   setUrl]   = useState('/club')

  // Phase: 'compose' → 'confirm' → 'sending' → 'done' (or back to compose on error)
  const [phase, setPhase]               = useState<'compose' | 'confirm' | 'sending' | 'done'>('compose')
  const [recipientCount, setRecipients] = useState<number>(initialSubscriberCount)
  const [recipientsLoading, setRLoad]   = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [result, setResult]             = useState<SendResult | null>(null)

  const titleTrim = title.trim()
  const bodyTrim  = body.trim()
  const urlTrim   = url.trim() || '/'
  const canPreview = titleTrim.length > 0
                  && bodyTrim.length > 0
                  && titleTrim.length <= TITLE_MAX
                  && bodyTrim.length  <= BODY_MAX

  async function openConfirm() {
    setError(null)
    if (!canPreview) return
    setPhase('confirm')
    setRLoad(true)
    try {
      const res = await fetch('/api/staff/announcements/recipients?target=all')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load recipient count')
      setRecipients(json.count ?? 0)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load recipient count')
    } finally {
      setRLoad(false)
    }
  }

  async function send() {
    setError(null)
    setPhase('sending')
    try {
      const res = await fetch('/api/staff/announcements', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          title:  titleTrim,
          body:   bodyTrim,
          url:    urlTrim,
          target: { type: 'all' },
        }),
      })
      const json: SendResult = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Send failed')
      setResult(json)
      setPhase('done')
      // Pull fresh history into the page below.
      startTransition(() => router.refresh())
    } catch (e: any) {
      setError(e.message ?? 'Send failed')
      setPhase('confirm')
    }
  }

  function reset() {
    setTitle('')
    setBody('')
    setUrl('/club')
    setError(null)
    setResult(null)
    setPhase('compose')
  }

  // ── Done state ────────────────────────────────────────────────────────────
  if (phase === 'done' && result) {
    return (
      <div className="bg-white border border-[#D4CFC3] rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-[#242622]">Announcement sent</p>
            <p className="text-sm text-[#7E613F]">
              Delivered to {result.sent ?? 0} of {result.subscriberCount ?? 0} subscribers.
              {result.failed ? ` ${result.failed} failed.` : ''}
              {result.expired ? ` ${result.expired} expired subscriptions cleaned up.` : ''}
            </p>
          </div>
        </div>
        {result.logged === false && (
          <p className="text-xs text-[#96321F] bg-[#FBE9E2] border border-[#F4C9BA] rounded-lg p-2">
            Push went out, but the audit log entry failed to save: {result.logError}
          </p>
        )}
        <button
          onClick={reset}
          className="text-sm text-[#96321F] font-semibold underline"
        >
          Send another →
        </button>
      </div>
    )
  }

  // ── Confirm state ─────────────────────────────────────────────────────────
  if (phase === 'confirm' || phase === 'sending') {
    const sending = phase === 'sending'
    return (
      <div className="bg-white border border-[#D4CFC3] rounded-2xl p-5 space-y-4">
        <div>
          <p className="text-xs font-semibold text-[#7E613F] uppercase tracking-wide">Confirm send</p>
          <p className="font-semibold text-[#242622] mt-1">
            About to send to {recipientsLoading ? '…' : recipientCount.toLocaleString()}{' '}
            {recipientCount === 1 ? 'subscriber' : 'subscribers'}.
          </p>
          <p className="text-xs text-[#7E613F] mt-1">
            Push goes out immediately. There's no undo.
          </p>
        </div>

        {/* Notification preview */}
        <div className="border border-[#D4CFC3] rounded-2xl p-4 bg-[#F8F6EE]">
          <p className="text-[10px] font-semibold text-[#9E8F7E] uppercase tracking-wide mb-2">
            Preview
          </p>
          <div className="bg-white rounded-xl border border-[#D4CFC3] p-3 shadow-sm">
            <div className="flex items-start gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-192.png" alt="" className="w-8 h-8 rounded-lg shrink-0"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[#242622] text-sm break-words">{titleTrim}</p>
                <p className="text-sm text-[#7E613F] mt-0.5 break-words">{bodyTrim}</p>
                <p className="text-[10px] text-[#9E8F7E] mt-1">Opens {urlTrim}</p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-[#96321F] bg-[#FBE9E2] border border-[#F4C9BA] rounded-lg p-2">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            disabled={sending}
            onClick={() => setPhase('compose')}
            className="flex-1 text-sm text-[#7E613F] bg-[#F1F1E7] py-2.5 rounded-xl hover:bg-[#D4CFC3] transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            disabled={sending || recipientsLoading}
            onClick={send}
            className="flex-[2] text-sm font-semibold bg-[#96321F] text-white py-2.5 rounded-xl hover:bg-[#ae3a24] transition-colors disabled:opacity-60"
          >
            {sending ? 'Sending…' : `Send to ${recipientCount.toLocaleString()}`}
          </button>
        </div>
      </div>
    )
  }

  // ── Compose state ─────────────────────────────────────────────────────────
  return (
    <div className="bg-white border border-[#D4CFC3] rounded-2xl p-5 space-y-4">
      <div>
        <label className="block text-xs font-semibold text-[#7E613F] uppercase tracking-wide mb-1">
          Title
        </label>
        <input
          type="text"
          value={title}
          maxLength={TITLE_MAX}
          onChange={e => setTitle(e.target.value)}
          placeholder="🍸 Trivia tonight at 8"
          className="w-full text-sm bg-[#F8F6EE] border border-[#D4CFC3] rounded-xl px-3 py-2.5 text-[#242622] placeholder:text-[#9E8F7E] focus:outline-none focus:border-[#96321F]"
        />
        <p className="text-[10px] text-[#9E8F7E] mt-1 text-right">
          {title.length}/{TITLE_MAX}
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#7E613F] uppercase tracking-wide mb-1">
          Message
        </label>
        <textarea
          value={body}
          rows={3}
          maxLength={BODY_MAX}
          onChange={e => setBody(e.target.value)}
          placeholder="Doors open at 7:30. Free first round for the winning team."
          className="w-full text-sm bg-[#F8F6EE] border border-[#D4CFC3] rounded-xl px-3 py-2.5 text-[#242622] placeholder:text-[#9E8F7E] focus:outline-none focus:border-[#96321F] resize-none"
        />
        <p className="text-[10px] text-[#9E8F7E] mt-1 text-right">
          {body.length}/{BODY_MAX}
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#7E613F] uppercase tracking-wide mb-1">
          Tap destination
        </label>
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="/club"
          className="w-full text-sm bg-[#F8F6EE] border border-[#D4CFC3] rounded-xl px-3 py-2.5 text-[#242622] placeholder:text-[#9E8F7E] focus:outline-none focus:border-[#96321F] font-mono"
        />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {QUICK_DESTINATIONS.map(d => (
            <button
              key={d.url}
              type="button"
              onClick={() => setUrl(d.url)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                url === d.url
                  ? 'bg-[#96321F] text-white border-[#96321F]'
                  : 'bg-[#F1F1E7] text-[#7E613F] border-[#D4CFC3] hover:border-[#96321F] hover:text-[#96321F]'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-[#7E613F]">
          ~{initialSubscriberCount.toLocaleString()} subscribed
        </p>
        <button
          disabled={!canPreview}
          onClick={openConfirm}
          className="text-sm font-semibold bg-[#96321F] text-white px-4 py-2.5 rounded-xl hover:bg-[#ae3a24] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Preview & send →
        </button>
      </div>
    </div>
  )
}
