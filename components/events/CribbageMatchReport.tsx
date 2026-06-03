// ─────────────────────────────────────────────
// Changelog
//   v2026-06-03.1 — New: players self-report each of their 3 cribbage matches
//                   (opponent, win/loss, spread) with a running nightly total
//                   and opponent-agreement status.
//   v2026-06-03.2 — Guest opponents (no app) + enforce a different opponent for
//                   each of the 3 matches.
// ─────────────────────────────────────────────
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

export interface PlayerOption { id: string; name: string }

export interface MatchReport {
  reporterId:   string
  opponentId:   string | null
  opponentName: string | null   // set when the opponent is a guest
  matchNumber:  number
  won:          boolean
  spread:       number
}

interface Props {
  periodId:      string
  currentUserId: string
  players:       PlayerOption[]   // everyone signed up (incl. self)
  reports:       MatchReport[]    // all reports for this period (everyone)
  slug?:         string           // event-type slug for the standings link
}

const MATCHES = [1, 2, 3]
const GUEST = '__guest__'

interface Draft { opponentId: string; guestName: string; won: boolean | null; spread: string }

export default function CribbageMatchReport({ periodId, currentUserId, players, reports: initialReports, slug }: Props) {
  const router = useRouter()
  const [reports, setReports] = useState<MatchReport[]>(initialReports)
  const [savingMatch, setSavingMatch] = useState<number | null>(null)
  const [error, setError] = useState('')

  const nameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of players) m[p.id] = p.name
    return m
  }, [players])

  const opponents = useMemo(() => players.filter(p => p.id !== currentUserId), [players, currentUserId])

  const myReports = reports.filter(r => r.reporterId === currentUserId)
  const myByMatch = (n: number) => myReports.find(r => r.matchNumber === n) ?? null

  // Running nightly total from this player's own reports.
  const wins   = myReports.filter(r => r.won).length
  const losses = myReports.filter(r => !r.won).length
  const spread = myReports.reduce((s, r) => s + r.spread, 0)

  // Opponent agreement for one of my matches.
  function agreement(mine: MatchReport): 'confirmed' | 'conflict' | 'pending' | 'guest' {
    if (!mine.opponentId) return 'guest'  // guests can't reconcile — no account
    const theirs = reports.find(r => r.reporterId === mine.opponentId && r.opponentId === currentUserId)
    if (!theirs) return 'pending'
    return theirs.won === !mine.won && theirs.spread === -mine.spread ? 'confirmed' : 'conflict'
  }

  // Local draft state per match row before saving.
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() => {
    const d: Record<number, Draft> = {}
    for (const n of MATCHES) {
      const r = initialReports.find(x => x.reporterId === currentUserId && x.matchNumber === n)
      d[n] = r
        ? { opponentId: r.opponentId ?? GUEST, guestName: r.opponentName ?? '', won: r.won, spread: String(r.spread) }
        : { opponentId: '', guestName: '', won: null, spread: '' }
    }
    return d
  })

  function setDraft(n: number, patch: Partial<Draft>) {
    setDrafts(d => ({ ...d, [n]: { ...d[n], ...patch } }))
  }

  // App opponents already chosen in OTHER match slots — can't be reused.
  function usedOpponentIds(exceptMatch: number): Set<string> {
    const ids = new Set<string>()
    for (const n of MATCHES) {
      if (n === exceptMatch) continue
      const id = drafts[n]?.opponentId
      if (id && id !== GUEST) ids.add(id)
    }
    return ids
  }

  async function saveMatch(n: number) {
    const draft = drafts[n]
    const isGuest = draft.opponentId === GUEST
    if (!draft.opponentId) { setError('Pick an opponent first'); return }
    if (isGuest && !draft.guestName.trim()) { setError('Enter the guest’s name'); return }
    if (draft.won === null) { setError('Mark the match won or lost'); return }
    setSavingMatch(n)
    setError('')
    const spreadNum = parseInt(draft.spread, 10) || 0
    const res = await fetch('/api/events/match-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        periodId,
        matchNumber: n,
        opponentId:   isGuest ? null : draft.opponentId,
        opponentName: isGuest ? draft.guestName.trim() : null,
        won: draft.won,
        spread: spreadNum,
      }),
    })
    let json: any = {}
    try { json = await res.json() } catch {}
    setSavingMatch(null)
    if (!res.ok) { setError(json.error ?? 'Could not save'); return }

    // Update local report list so the running total + status refresh instantly.
    setReports(prev => {
      const without = prev.filter(r => !(r.reporterId === currentUserId && r.matchNumber === n))
      return [...without, {
        reporterId:   currentUserId,
        opponentId:   isGuest ? null : draft.opponentId,
        opponentName: isGuest ? draft.guestName.trim() : null,
        matchNumber:  n,
        won:          draft.won as boolean,
        spread:       spreadNum,
      }]
    })
    router.refresh()
  }

  const STATUS = {
    confirmed: { label: 'Confirmed', cls: 'text-[#5a7a54] bg-[#87A67F]/15 border-[#87A67F]' },
    conflict:  { label: 'Doesn’t match opponent', cls: 'text-[#96321F] bg-[#96321F]/10 border-[#96321F]/40' },
    pending:   { label: 'Waiting on opponent', cls: 'text-[#7E613F] bg-[#EDE9DC] border-[#C8BCA4]' },
    guest:     { label: 'Guest', cls: 'text-[#7E613F] bg-[#EDE9DC] border-[#C8BCA4]' },
  } as const

  return (
    <div className="space-y-4">
      {/* Running nightly total */}
      <div className="bg-[#96321F] text-white rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest opacity-80">Your night so far</p>
          <p className="text-2xl font-bold mt-0.5">{wins}W – {losses}L</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest opacity-80">Spread</p>
          <p className="text-2xl font-bold mt-0.5">{spread >= 0 ? `+${spread}` : spread}</p>
        </div>
      </div>

      <p className="text-xs text-[#7E613F]">
        You play 3 matches — a different opponent each time. Report each one. If they have the app, their report confirms yours; otherwise add them as a guest.
      </p>

      {MATCHES.map(n => {
        const saved = myByMatch(n)
        const draft = drafts[n]
        const status = saved ? agreement(saved) : null
        const isGuest = draft.opponentId === GUEST
        const used = usedOpponentIds(n)
        return (
          <div key={n} className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-[#242622]">Match {n}</p>
              {status && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS[status].cls}`}>
                  {STATUS[status].label}
                </span>
              )}
            </div>

            {/* Opponent */}
            <select
              value={draft.opponentId}
              onChange={e => setDraft(n, { opponentId: e.target.value })}
              className="w-full bg-[#FFFFFF] border border-[#C8BCA4] rounded-lg px-3 min-h-[44px] text-[#242622] text-base focus:outline-none focus:border-[#96321F]"
            >
              <option value="">Choose opponent…</option>
              {opponents.map(o => (
                <option key={o.id} value={o.id} disabled={used.has(o.id)}>
                  {o.name}{used.has(o.id) ? ' (already played)' : ''}
                </option>
              ))}
              <option value={GUEST}>Guest (not on the app)…</option>
            </select>

            {isGuest && (
              <input
                type="text"
                value={draft.guestName}
                onChange={e => setDraft(n, { guestName: e.target.value })}
                placeholder="Guest’s name"
                className="w-full bg-white border border-[#C8BCA4] rounded-lg px-3 min-h-[44px] text-[#242622] text-base focus:outline-none focus:border-[#96321F]"
              />
            )}

            <div className="grid grid-cols-[1fr_96px] gap-2">
              {/* Win / Loss */}
              <div className="flex gap-2">
                <button
                  onClick={() => setDraft(n, { won: true })}
                  className={`flex-1 min-h-[44px] rounded-lg text-sm font-bold border transition-all active:scale-95 ${
                    draft.won === true ? 'bg-[#87A67F] text-white border-[#87A67F]' : 'bg-white text-[#7E613F] border-[#D4CFC3] hover:border-[#87A67F]/60'
                  }`}
                >
                  Won
                </button>
                <button
                  onClick={() => setDraft(n, { won: false })}
                  className={`flex-1 min-h-[44px] rounded-lg text-sm font-bold border transition-all active:scale-95 ${
                    draft.won === false ? 'bg-[#96321F] text-white border-[#96321F]' : 'bg-white text-[#7E613F] border-[#D4CFC3] hover:border-[#96321F]/50'
                  }`}
                >
                  Lost
                </button>
              </div>

              {/* Spread */}
              <input
                type="number"
                value={draft.spread}
                onChange={e => setDraft(n, { spread: e.target.value })}
                placeholder="Spread"
                className="bg-white border border-[#C8BCA4] rounded-lg px-2 min-h-[44px] text-[#242622] text-base focus:outline-none focus:border-[#96321F] text-center"
              />
            </div>

            {status === 'conflict' && (
              <p className="text-xs text-[#96321F]">
                {(saved!.opponentId && nameById[saved!.opponentId]) || 'Your opponent'} reported this match differently — double-check with them.
              </p>
            )}

            <button
              onClick={() => saveMatch(n)}
              disabled={savingMatch === n || !draft.opponentId || draft.won === null || (isGuest && !draft.guestName.trim())}
              className="w-full bg-[#96321F] text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-40 hover:bg-[#ae3a24] active:scale-[0.98] transition-all"
            >
              {savingMatch === n ? 'Saving…' : saved ? 'Update Match' : 'Save Match'}
            </button>
          </div>
        )
      })}

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}

      {slug && (
        <a
          href={`/leaderboards/${slug}`}
          className="block text-center text-sm text-[#96321F] hover:text-[#ae3a24] font-medium pt-1"
        >
          See tonight’s standings →
        </a>
      )}
    </div>
  )
}
