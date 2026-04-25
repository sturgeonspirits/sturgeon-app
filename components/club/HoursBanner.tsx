// ─────────────────────────────────────────────
// Changelog
//   v2026-04-25.1 — New component. Shows live "Open now" / "Closes at" /
//                   "Opens tomorrow" status for one location, with a tap-to-
//                   expand weekly schedule.
// ─────────────────────────────────────────────

'use client'

import { useState } from 'react'
import {
  computeStatus,
  formatTime12h,
  DAY_SHORT,
  type HoursRow,
  type HoursStatus,
} from '@/lib/hours'

export default function HoursBanner({
  location,
  rows,
}: {
  location: string
  rows: HoursRow[]
}) {
  const [expanded, setExpanded] = useState(false)

  // Compute status on every render. The cost is trivial and it stays fresh
  // as long as the page is open.
  const status: HoursStatus = computeStatus(rows)

  const palette = palettes[status.kind] ?? palettes.unknown
  const dot     = dotForStatus(status)

  // Build a Sun→Sat schedule from the weekly rows for the expanded view.
  const weekly = (() => {
    const byDow = new Map<number, HoursRow>()
    for (const r of rows) {
      if (r.day_of_week !== null && r.override_date === null) byDow.set(r.day_of_week, r)
    }
    return [0, 1, 2, 3, 4, 5, 6].map(dow => ({ dow, row: byDow.get(dow) }))
  })()

  return (
    <button
      type="button"
      onClick={() => setExpanded(e => !e)}
      className="w-full text-left rounded-2xl border transition-all active:scale-[0.99]"
      style={{
        background:  palette.bg,
        borderColor: palette.border,
      }}
    >
      <div className="flex items-center gap-3 p-3">
        <span
          className="inline-block w-2 h-2 rounded-full shrink-0"
          style={{ background: dot.color, boxShadow: dot.glow ? `0 0 8px ${dot.color}` : 'none' }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: palette.label }}>
            {location}
          </p>
          <p className="text-sm font-semibold leading-tight" style={{ color: palette.text }}>
            {status.message}
          </p>
        </div>
        <span
          aria-hidden
          className="text-xs transition-transform shrink-0"
          style={{ color: palette.label, transform: expanded ? 'rotate(180deg)' : 'none' }}
        >
          ▾
        </span>
      </div>

      {expanded && (
        <div className="border-t px-3 py-2" style={{ borderColor: palette.border }}>
          <ul className="space-y-1">
            {weekly.map(({ dow, row }) => (
              <li
                key={dow}
                className="flex items-center justify-between text-xs"
                style={{ color: palette.text }}
              >
                <span className="font-medium" style={{ color: palette.label }}>
                  {DAY_SHORT[dow]}
                </span>
                <span className="tabular-nums">
                  {row?.is_closed || !row?.open_time
                    ? 'Closed'
                    : `${formatTime12h(row.open_time)} – ${formatTime12h(row.close_time)}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </button>
  )
}

// ── Palettes ─────────────────────────────────────────────────────────────────
//
// Open      → muted brand olive, calm green dot.
// Open soon → amber accent so customers see the "closing in 60 min" nudge.
// Closed    → neutral warm gray that fits the rest of the /club page.

const palettes = {
  open: {
    bg:     '#F1F5EE',
    border: '#C7D5BD',
    label:  '#5C7A4F',
    text:   '#2F4A28',
  },
  closed_today: {
    bg:     '#F1F1E7',
    border: '#D4CFC3',
    label:  '#9E8F7E',
    text:   '#7E613F',
  },
  closed_now: {
    bg:     '#F1F1E7',
    border: '#D4CFC3',
    label:  '#9E8F7E',
    text:   '#7E613F',
  },
  unknown: {
    bg:     '#F1F1E7',
    border: '#D4CFC3',
    label:  '#9E8F7E',
    text:   '#7E613F',
  },
} as const

function dotForStatus(s: HoursStatus): { color: string; glow: boolean } {
  if (s.kind === 'open') {
    return s.warning
      ? { color: '#D89B3F', glow: true }   // amber, glowing
      : { color: '#7BAE5F', glow: true }   // green, glowing
  }
  return { color: '#B0A998', glow: false }
}
