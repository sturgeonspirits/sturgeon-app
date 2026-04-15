/**
 * /display — Public check-in QR display for the bar tablet.
 *
 * No auth required. Shows only the daily QR code.
 * Auto-reloads at midnight Chicago time so the token stays current.
 *
 * Layout:
 *   • Portrait  → vertical stack (brand, QR, text, date)
 *   • Landscape → QR on the left, text on the right (fits 1024x768 easily)
 */
import QRCode from 'qrcode'
import { getDailyToken } from '@/lib/checkin-token'
import MidnightRefresh from './MidnightRefresh'

export const dynamic = 'force-dynamic' // always fresh — token rotates daily

export default async function DisplayPage() {
  const token   = getDailyToken()
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://club.sturgeonspirits.com'
  const checkInUrl = `${appUrl}/checkin?t=${token}`

  const qrSvg = await QRCode.toString(checkInUrl, {
    type:                 'svg',
    margin:               2,
    color:                { dark: '#242622', light: '#F1F1E7' },
    errorCorrectionLevel: 'H',
    width:                420,
  })

  const today = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    weekday:  'long',
    month:    'long',
    day:      'numeric',
  })

  return (
    <>
      <MidnightRefresh />

      {/*
        Orientation-aware layout via inline CSS:
        - portrait:  flex-column, everything stacked
        - landscape: flex-row, QR card on the left, text on the right
        h-dvh + overflow-hidden guarantees no overflow in either orientation.
      */}
      <style>{`
        .display-root {
          min-height: 100dvh;
          height: 100dvh;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #242622;
          padding: 3vh 4vw;
          gap: 4vw;
          user-select: none;
        }
        .display-qr-card {
          background: #F1F1E7;
          border-radius: 24px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.4);
          padding: clamp(12px, 2vh, 24px);
          flex-shrink: 0;
        }
        .display-qr {
          display: block;
          width:  min(75vh, 75vw, 520px);
          height: min(75vh, 75vw, 520px);
        }
        .display-text {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: clamp(10px, 1.8vh, 22px);
        }
        .display-brand-tag {
          font-size: clamp(11px, 1.4vh, 14px);
          font-weight: 700;
          color: #9E8F7E;
          text-transform: uppercase;
          letter-spacing: 0.3em;
        }
        .display-brand {
          font-size: clamp(1.5rem, 4vh, 2.6rem);
          font-weight: 700;
          color: #FFFFFF;
          letter-spacing: 0.02em;
          line-height: 1.1;
        }
        .display-cta {
          font-size: clamp(1.4rem, 4vh, 2.4rem);
          font-weight: 700;
          color: #FFFFFF;
          line-height: 1.1;
        }
        .display-sub {
          font-size: clamp(0.95rem, 2vh, 1.3rem);
          color: #C8BCA4;
          line-height: 1.35;
          max-width: 28ch;
        }
        .display-signup {
          font-size: clamp(1.1rem, 2.6vh, 1.7rem);
          color: #FFFFFF;
          font-weight: 600;
          margin-top: clamp(8px, 1.4vh, 18px);
          padding: clamp(10px, 1.8vh, 18px) clamp(14px, 2.4vw, 24px);
          background: rgba(150, 50, 31, 0.18);
          border: 2px solid rgba(150, 50, 31, 0.6);
          border-radius: 16px;
        }
        .display-signup .label {
          display: block;
          font-size: 0.7em;
          color: #C8BCA4;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .display-signup .url {
          color: #FFFFFF;
          font-weight: 700;
        }
        .display-date {
          font-size: clamp(10px, 1.2vh, 13px);
          color: #9E8F7E;
          text-transform: uppercase;
          letter-spacing: 0.3em;
          margin-top: clamp(6px, 1vh, 12px);
        }

        /* Landscape — side-by-side, text right of QR */
        @media (orientation: landscape) {
          .display-root { flex-direction: row; }
          .display-text { align-items: flex-start; text-align: left; }
          .display-sub { max-width: 34ch; }
        }

        /* Portrait — stacked */
        @media (orientation: portrait) {
          .display-root { flex-direction: column; }
          .display-qr {
            width:  min(70vw, 60vh, 460px);
            height: min(70vw, 60vh, 460px);
          }
        }
      `}</style>

      <div className="display-root">
        <div className="display-qr-card">
          <div className="display-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        </div>

        <div className="display-text">
          <div>
            <div className="display-brand-tag">Sturgeon Spirits</div>
            <div className="display-brand">Spearers Club</div>
          </div>

          <div className="display-cta">Scan to Check In</div>

          <div className="display-sub">
            Open Spearers Club on your phone and point the camera here
          </div>

          <div className="display-signup">
            <span className="label">New member?</span>
            <span className="url">club.sturgeonspirits.com</span>
          </div>

          <div className="display-date">{today}</div>
        </div>
      </div>
    </>
  )
}
