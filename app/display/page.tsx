/**
 * /display — Public check-in QR display for the bar tablet.
 *
 * No auth required. Shows only the daily QR code.
 * Auto-reloads at midnight Chicago time so the token stays current.
 */
import QRCode from 'qrcode'
import { getDailyToken } from '@/lib/checkin-token'
import MidnightRefresh from './MidnightRefresh'

export const dynamic = 'force-dynamic' // always fresh — token rotates daily

export default async function DisplayPage() {
  const token   = getDailyToken()
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://club.sturgeonspirits.com'
  const checkInUrl = `${appUrl}/checkin?t=${token}`

  // Generate QR code as inline SVG string — no external requests, works offline
  const qrSvg = await QRCode.toString(checkInUrl, {
    type:         'svg',
    margin:       2,
    color:        { dark: '#242622', light: '#F1F1E7' },
    errorCorrectionLevel: 'H', // highest — tolerates minor screen glare
    width:        360,
  })

  // Today's date in Chicago time for the footer
  const today = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long',
    month:   'long',
    day:     'numeric',
  })

  return (
    <>
      <MidnightRefresh />

      {/*
        h-dvh + overflow-hidden = exactly one screen, no scroll, no overflow.
        gap-based spacing instead of margins so the flex container distributes
        space evenly and nothing ever pushes outside the viewport.
        Works in both portrait and landscape on any tablet size.
      */}
      <div
        className="bg-[#242622] flex flex-col items-center justify-center select-none overflow-hidden"
        style={{ height: '100dvh', padding: 'clamp(12px, 3vh, 32px) clamp(16px, 4vw, 48px)', gap: 'clamp(8px, 2vh, 24px)' }}
      >
        {/* Brand header */}
        <div className="text-center shrink-0">
          <p className="font-bold text-[#9E8F7E] uppercase tracking-[0.3em]"
            style={{ fontSize: 'clamp(9px, 1.2vh, 13px)' }}>
            Sturgeon Spirits
          </p>
          <p className="text-white font-bold tracking-wide leading-tight"
            style={{ fontSize: 'clamp(1.1rem, 3.5vh, 2.2rem)', fontFamily: 'var(--font-display, sans-serif)' }}>
            Spearers Club
          </p>
        </div>

        {/* QR code card — sized to the smaller of 52vh or 52vw so it always fits */}
        <div
          className="bg-[#F1F1E7] rounded-2xl shadow-2xl shrink-0 flex items-center justify-center"
          style={{ padding: 'clamp(10px, 2vh, 20px)' }}
        >
          <div
            style={{
              width:  'min(52vh, 52vw, 420px)',
              height: 'min(52vh, 52vw, 420px)',
              display: 'block',
            }}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        </div>

        {/* Instructions */}
        <div className="text-center shrink-0" style={{ gap: 'clamp(4px, 1vh, 10px)', display: 'flex', flexDirection: 'column' }}>
          <p className="font-bold text-white leading-tight"
            style={{ fontSize: 'clamp(1rem, 3vh, 1.75rem)' }}>
            Scan to Check In
          </p>
          <p className="text-[#9E8F7E] leading-snug"
            style={{ fontSize: 'clamp(0.7rem, 1.6vh, 1rem)' }}>
            Open Spearers Club on your phone and scan with the camera
          </p>
          <p className="text-[#C8BCA4] leading-snug"
            style={{ fontSize: 'clamp(0.7rem, 1.6vh, 1rem)' }}>
            New member? Sign up at{' '}
            <span className="text-white font-semibold">club.sturgeonspirits.com</span>
          </p>
        </div>

        {/* Date — in flow, not absolute */}
        <p className="text-[#9E8F7E] uppercase tracking-widest shrink-0"
          style={{ fontSize: 'clamp(9px, 1.2vh, 12px)' }}>
          {today}
        </p>
      </div>
    </>
  )
}
