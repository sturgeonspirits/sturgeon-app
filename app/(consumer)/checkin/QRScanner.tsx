'use client'

import { useEffect, useRef, useState } from 'react'
import { RocksGlass, GlassesClinking, Anchor } from '@/components/icons/brand'

// jsQR is CJS — dynamic import avoids SSR issues
type JsQR = (data: Uint8ClampedArray, width: number, height: number, options?: { inversionAttempts?: string }) => { data: string } | null

// Extract the daily token from a check-in URL like:
//   https://club.sturgeonspirits.com/checkin?t=TOKEN
//   /checkin?t=TOKEN
function extractToken(raw: string): string | null {
  try {
    const url = new URL(raw, 'https://club.sturgeonspirits.com')
    if (url.pathname === '/checkin' || url.pathname === '/checkin/') {
      return url.searchParams.get('t')
    }
  } catch { /* not a URL */ }
  return null
}

type Phase =
  | 'requesting'   // waiting for camera permission
  | 'scanning'     // live video, looking for QR
  | 'checking-in'  // found token, calling API
  | 'success'      // check-in done
  | 'birthday'     // birthday cocktail unlocked
  | 'already'      // already checked in today
  | 'error'        // something went wrong

export default function QRScanner() {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef    = useRef<number>(0)

  const [phase,    setPhase]   = useState<Phase>('requesting')
  const [message,  setMessage] = useState('')
  const [points,   setPoints]  = useState(15)

  // ── Stop camera ────────────────────────────────────────────────
  function stopCamera() {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  // ── Call check-in API once we have a token ─────────────────────
  async function doCheckIn(token: string) {
    stopCamera()
    setPhase('checking-in')
    try {
      const res  = await fetch('/api/checkin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token }),
      })
      const json = await res.json()
      if (res.ok) {
        setPoints(json.pointsEarned ?? 15)
        setPhase(json.birthdayCocktail ? 'birthday' : 'success')
      } else if (res.status === 409) {
        setPhase('already')
      } else {
        setMessage(json.error ?? 'Something went wrong — please try again.')
        setPhase('error')
      }
    } catch {
      setMessage('Request timed out — please try again.')
      setPhase('error')
    }
  }

  // ── Start camera + scan loop ───────────────────────────────────
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('Camera not available in this browser. Ask a bartender to scan the QR code for you.')
      setPhase('error')
      return
    }

    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }

        streamRef.current = stream
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()

        // Lazily load jsQR to keep initial bundle small
        const { default: jsQR } = await import('jsqr') as { default: JsQR }
        if (cancelled) return

        setPhase('scanning')

        function scan() {
          const video  = videoRef.current
          const canvas = canvasRef.current
          if (!video || !canvas || cancelled) return

          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width  = video.videoWidth
            canvas.height = video.videoHeight
            const ctx = canvas.getContext('2d', { willReadFrequently: true })!
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            })
            if (code?.data) {
              const token = extractToken(code.data)
              if (token) {
                doCheckIn(token)
                return   // stop the loop — doCheckIn handles everything else
              }
            }
          }
          rafRef.current = requestAnimationFrame(scan)
        }
        rafRef.current = requestAnimationFrame(scan)

      } catch (err: any) {
        if (cancelled) return
        const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
        setMessage(
          denied
            ? 'Camera permission denied. Please allow camera access in your browser settings and try again.'
            : 'Could not start camera — please try again.',
        )
        setPhase('error')
      }
    }

    start()

    return () => {
      cancelled = true
      stopCamera()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Result screens ─────────────────────────────────────────────
  if (phase === 'birthday') {
    return (
      <ResultScreen>
        <GlassesClinking size={80} className="text-[#96321F] animate-bounce mx-auto" />
        <p className="text-2xl font-bold text-[#96321F]">Happy Birthday!</p>
        <p className="text-sm text-[#7E613F] text-center">
          You've got a <strong>free cocktail</strong> waiting — show this screen to your bartender.
        </p>
        <div className="bg-[#96321F]/5 border border-[#96321F]/20 rounded-2xl px-6 py-4 text-center w-full">
          <p className="text-2xl font-bold text-[#96321F]">Birthday Cocktail</p>
          <p className="text-xs text-[#7E613F] mt-1">Valid 30 days</p>
        </div>
        <p className="text-xs text-[#9E8F7E]">+{points} check-in points also added</p>
        <BackToClub />
      </ResultScreen>
    )
  }

  if (phase === 'success') {
    return (
      <ResultScreen>
        <RocksGlass size={80} className="text-[#96321F] mx-auto" />
        <p className="text-3xl font-bold text-[#96321F]">+{points} pts</p>
        <p className="text-sm text-[#7E613F]">Checked in! Enjoy your visit.</p>
        <BackToClub />
      </ResultScreen>
    )
  }

  if (phase === 'already') {
    return (
      <ResultScreen>
        <RocksGlass size={64} className="text-[#87A67F] mx-auto" />
        <p className="text-base font-semibold text-[#242622] text-center">
          You've already checked in today — see you next time!
        </p>
        <BackToClub />
      </ResultScreen>
    )
  }

  if (phase === 'error') {
    return (
      <ResultScreen>
        <Anchor size={64} className="text-[#9E8F7E] mx-auto" />
        <p className="text-sm text-[#7E613F] text-center max-w-xs">{message}</p>
        <BackToClub />
      </ResultScreen>
    )
  }

  if (phase === 'checking-in') {
    return (
      <ResultScreen>
        <p className="text-4xl animate-spin">⏳</p>
        <p className="text-sm text-[#7E613F]">Checking in…</p>
      </ResultScreen>
    )
  }

  // ── Scanner UI (requesting + scanning) ────────────────────────
  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Live camera feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Hidden canvas for frame analysis */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Dark vignette overlay with cutout hint */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {/* Viewfinder box */}
        <div className="relative w-64 h-64">
          {/* Semi-transparent surround */}
          <div className="absolute -inset-[100vw] bg-black/50" />
          {/* Clear window */}
          <div className="absolute inset-0 bg-transparent" />
          {/* Corner brackets */}
          {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
            <span
              key={i}
              className={`absolute w-7 h-7 border-[#96321F] ${pos} ${
                i === 0 ? 'border-t-4 border-l-4 rounded-tl-lg' :
                i === 1 ? 'border-t-4 border-r-4 rounded-tr-lg' :
                i === 2 ? 'border-b-4 border-l-4 rounded-bl-lg' :
                          'border-b-4 border-r-4 rounded-br-lg'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Bottom HUD */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-6 pb-10 pt-16">
        <p className="text-white font-semibold text-center text-base mb-1">
          {phase === 'requesting' ? 'Starting camera…' : 'Point at the check-in QR code'}
        </p>
        <p className="text-white/60 text-xs text-center mb-6">
          Ask a bartender to show you the QR code
        </p>
        <a
          href="/club"
          className="block w-full text-center text-white/70 text-sm py-3 border border-white/20 rounded-2xl hover:bg-white/10 transition-colors"
        >
          Cancel
        </a>
      </div>
    </div>
  )
}

function ResultScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F1F1E7] flex flex-col items-center justify-center px-6 py-12 gap-4">
      {children}
    </div>
  )
}

function BackToClub() {
  return (
    <a
      href="/club"
      className="mt-2 block w-full max-w-xs bg-[#96321F] text-white font-semibold py-3.5 rounded-2xl text-center hover:bg-[#ae3a24] transition-colors"
    >
      Back to my profile →
    </a>
  )
}
