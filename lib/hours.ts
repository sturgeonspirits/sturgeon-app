// ─────────────────────────────────────────────
// Changelog
//   v2026-04-25.1 — New module. Parses Google Sheets hours strings and
//                   computes "open now" / "opens at" / "closing soon" status.
// ─────────────────────────────────────────────

/**
 * Distillery hours — parsing + open-now logic.
 *
 * The Google Sheet stores hours as human-readable strings like
 * "4 PM - 8 PM" or "9 PM - 2 AM" or "Closed". This module turns those
 * into structured rows and computes the current status for display on
 * the /club home banner.
 */

const TZ = 'America/Chicago'

/** Day-of-week integers match Postgres + JS conventions: 0 = Sunday … 6 = Saturday. */
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const DAY_NAME_TO_NUM: Record<string, number> = {
  sun: 0, sunday:    0,
  mon: 1, monday:    1,
  tue: 2, tues:      2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thurs:     4, thursday: 4,
  fri: 5, friday:    5,
  sat: 6, saturday:  6,
}

export interface HoursRow {
  id?:              string
  location:         string
  day_of_week:      number | null
  override_date:    string | null   // YYYY-MM-DD
  is_closed:        boolean
  open_time:        string | null   // HH:MM:SS
  close_time:       string | null   // HH:MM:SS
  closes_next_day:  boolean
  note:             string | null
  is_primary?:      boolean
  sort_order?:      number
  raw_hours_text?:  string | null
}

/** Parse a sheet value like "Monday" → 1, "Sun" → 0, "" → null. */
export function parseDayOfWeek(raw: string | null | undefined): number | null {
  if (!raw) return null
  const k = raw.trim().toLowerCase()
  return DAY_NAME_TO_NUM[k] ?? null
}

/**
 * Parse a sheet hours cell into structured pieces.
 * Returns { is_closed, open, close, closes_next_day } where times are HH:MM 24-hour or null.
 *
 * Accepts:
 *   "Closed", "closed", "CLOSED"
 *   "4 PM - 8 PM", "4PM-8PM", "4:00 PM - 8:00 PM"
 *   "10 AM - 6 PM"
 *   "9 PM - 2 AM"  (closes next day)
 *   "Noon - 6 PM", "Midnight"  (informally)
 *   en-dash / em-dash / "to" as separators
 */
export function parseHoursCell(raw: string | null | undefined): {
  is_closed: boolean
  open_time: string | null
  close_time: string | null
  closes_next_day: boolean
} {
  if (!raw) return { is_closed: true, open_time: null, close_time: null, closes_next_day: false }

  const txt = raw.trim()
  if (!txt) return { is_closed: true, open_time: null, close_time: null, closes_next_day: false }

  if (/^closed$/i.test(txt)) {
    return { is_closed: true, open_time: null, close_time: null, closes_next_day: false }
  }

  // Split on -, –, —, or " to "
  const parts = txt.split(/\s*[-–—]\s*|\s+to\s+/i)
  if (parts.length !== 2) {
    // Couldn't parse — treat as closed and let the audit log show the raw text
    return { is_closed: true, open_time: null, close_time: null, closes_next_day: false }
  }

  const open  = parseClock(parts[0])
  const close = parseClock(parts[1])
  if (!open || !close) {
    return { is_closed: true, open_time: null, close_time: null, closes_next_day: false }
  }

  // If close <= open, treat as next-day close (e.g., "9 PM - 2 AM").
  // Equality is treated as next-day too (24-hour hours), though that's unusual.
  const closes_next_day = timeToMinutes(close) <= timeToMinutes(open)

  return { is_closed: false, open_time: open, close_time: close, closes_next_day }
}

/** Parse "4 PM" / "4:30 PM" / "16:00" / "Noon" / "Midnight" → "HH:MM" 24-hour. */
function parseClock(raw: string): string | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase()
  if (s === 'noon')     return '12:00'
  if (s === 'midnight') return '00:00'

  // 24-hour: "16:00", "9:30"
  const military = s.match(/^(\d{1,2}):(\d{2})$/)
  if (military) {
    const h = +military[1], m = +military[2]
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return pad2(h) + ':' + pad2(m)
  }

  // 12-hour: "4 PM", "4:30 PM", "12 AM"
  const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/)
  if (ampm) {
    let h = +ampm[1]
    const m = ampm[2] ? +ampm[2] : 0
    const meridiem = ampm[3]
    if (h < 1 || h > 12 || m < 0 || m >= 60) return null
    if (meridiem === 'am') h = (h === 12 ? 0 : h)
    else                   h = (h === 12 ? 12 : h + 12)
    return pad2(h) + ':' + pad2(m)
  }

  return null
}

function pad2(n: number) { return n.toString().padStart(2, '0') }

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Format an HH:MM (or HH:MM:SS) string back to "4 PM" / "4:30 PM". */
export function formatTime12h(hhmm: string | null): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const meridiem = h < 12 ? 'AM' : 'PM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${h12} ${meridiem}` : `${h12}:${pad2(m)} ${meridiem}`
}

/** YYYY-MM-DD in America/Chicago for a given Date (defaults to now). */
export function chicagoDateString(d = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}

/** Day-of-week number (0=Sun…6=Sat) in America/Chicago for a given Date. */
export function chicagoDayOfWeek(d = new Date()): number {
  const wd = d.toLocaleString('en-US', { timeZone: TZ, weekday: 'short' })
  return DAY_NAME_TO_NUM[wd.toLowerCase()] ?? d.getDay()
}

/** Current minutes-since-midnight in America/Chicago. */
export function chicagoMinutesNow(d = new Date()): number {
  const parts = d.toLocaleString('en-US', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  })
  // "13:42" or "13:42:00"
  const [h, m] = parts.split(':').map(Number)
  return h * 60 + m
}

// ── Status computation ────────────────────────────────────────────────────────

export type HoursStatus =
  | { kind: 'open';          message: string; closesAt: string;  warning: boolean }
  | { kind: 'closed_today';  message: string; nextOpen: NextOpen | null }
  | { kind: 'closed_now';    message: string; nextOpen: NextOpen | null }   // not yet open today
  | { kind: 'unknown';       message: string }

interface NextOpen {
  day_of_week: number   // 0..6
  open_time: string     // HH:MM
  is_today: boolean
  is_tomorrow: boolean
  date: string          // YYYY-MM-DD
}

const CLOSING_SOON_MIN = 60   // amber warning when within this many minutes of close

/**
 * Given all hours rows for one location, compute the current status.
 *
 * Algorithm:
 *   1. Today's effective row = override_date matching today, else day_of_week.
 *   2. If row is closed → look for the next open day in the next 7 days.
 *   3. If row is open and now >= open_time:
 *        - If now < close_time (with next-day handling) → "Open — closes at X"
 *        - Else → "Closed for the night, opens [next open day]"
 *   4. If row is open and now < open_time → "Closed — opens at X"
 *   5. Anything weird → "unknown"
 */
export function computeStatus(rows: HoursRow[], now = new Date()): HoursStatus {
  if (!rows.length) return { kind: 'unknown', message: 'Hours unavailable' }

  const todayDate = chicagoDateString(now)
  const todayDow  = chicagoDayOfWeek(now)
  const minsNow   = chicagoMinutesNow(now)

  const todayRow = effectiveRowForDate(rows, todayDate, todayDow)
  if (!todayRow) {
    return { kind: 'unknown', message: 'Hours unavailable' }
  }

  if (todayRow.is_closed) {
    const next = findNextOpen(rows, now, /* fromTodayInclusive */ false)
    return {
      kind: 'closed_today',
      message: next
        ? `Closed today · ${nextOpenSentence(next)}`
        : 'Closed today',
      nextOpen: next,
    }
  }

  if (!todayRow.open_time || !todayRow.close_time) {
    return { kind: 'unknown', message: 'Hours unavailable' }
  }

  const openMin  = timeToMinutes(todayRow.open_time)
  const closeMin = timeToMinutes(todayRow.close_time)
                 + (todayRow.closes_next_day ? 24 * 60 : 0)

  // Pre-open
  if (minsNow < openMin) {
    return {
      kind: 'closed_now',
      message: `Closed · Opens at ${formatTime12h(todayRow.open_time)}`,
      nextOpen: {
        day_of_week: todayDow,
        open_time:   todayRow.open_time,
        is_today:    true,
        is_tomorrow: false,
        date:        todayDate,
      },
    }
  }

  // Open
  if (minsNow < closeMin) {
    const remaining = closeMin - minsNow
    const warning = remaining <= CLOSING_SOON_MIN
    return {
      kind:     'open',
      message:  warning
        ? `Closing soon · ${formatTime12h(todayRow.close_time)}`
        : `Open now · Closes at ${formatTime12h(todayRow.close_time)}`,
      closesAt: todayRow.close_time,
      warning,
    }
  }

  // After close
  const next = findNextOpen(rows, now, /* fromTodayInclusive */ false)
  return {
    kind: 'closed_now',
    message: next
      ? `Closed · ${nextOpenSentence(next)}`
      : 'Closed',
    nextOpen: next,
  }
}

/** Return the row that applies to a given date — override_date wins, else day_of_week. */
export function effectiveRowForDate(rows: HoursRow[], dateStr: string, dow: number): HoursRow | null {
  const override = rows.find(r => r.override_date === dateStr)
  if (override) return override
  const weekly = rows.find(r => r.day_of_week === dow && r.override_date === null)
  return weekly ?? null
}

/** Search forward from tomorrow (or today inclusive) for the next open day. */
function findNextOpen(rows: HoursRow[], now: Date, fromTodayInclusive: boolean): NextOpen | null {
  const startOffset = fromTodayInclusive ? 0 : 1
  for (let offset = startOffset; offset < 8; offset++) {
    const d = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000)
    const dateStr = chicagoDateString(d)
    const dow     = chicagoDayOfWeek(d)
    const row     = effectiveRowForDate(rows, dateStr, dow)
    if (row && !row.is_closed && row.open_time) {
      return {
        day_of_week: dow,
        open_time:   row.open_time,
        is_today:    offset === 0,
        is_tomorrow: offset === 1,
        date:        dateStr,
      }
    }
  }
  return null
}

function nextOpenSentence(n: NextOpen): string {
  const time = formatTime12h(n.open_time)
  if (n.is_today)    return `opens today at ${time}`
  if (n.is_tomorrow) return `opens tomorrow at ${time}`
  return `opens ${DAY_NAMES[n.day_of_week]} at ${time}`
}
