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

      <div className="min-h-screen bg-[#242622] flex flex-col items-center justify-center px-6 py-10 select-none">

        {/* Brand header */}
        <div className="text-center mb-10">
          <p className="text-[10px] font-bold text-[#9E8F7E] uppercase tracking-[0.3em] mb-1">
            Sturgeon Spirits
          </p>
          <p
            className="text-white font-bold tracking-wide"
            style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontFamily: 'var(--font-display, sans-serif)' }}
          >
            Spearers Club
          </p>
        </div>

        {/* QR code card */}
        <div className="bg-[#F1F1E7] rounded-3xl p-6 shadow-2xl">
          {/* Render QR as inline SVG — crisp at any resolution */}
          <div
            className="block"
            style={{ width: 'clamp(220px, 40vw, 360px)', height: 'clamp(220px, 40vw, 360px)' }}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        </div>

        {/* Instruction */}
        <div className="text-center mt-10 space-y-2">
          <p
            className="font-bold text-white"
            style={{ fontSize: 'clamp(1.25rem, 3vw, 2rem)' }}
          >
            Scan to Check In
          </p>
          <p className="text-[#9E8F7E] text-sm tracking-wide">
            Open Spearers Club on your phone and scan with the camera
          </p>
        </div>

        {/* Date footer */}
        <p className="absolute bottom-6 text-[#9E8F7E] text-xs tracking-widest uppercase">
          {today}
        </p>

      </div>
    </>
  )
}
