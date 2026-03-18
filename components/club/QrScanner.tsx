'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  missionId: string
  userId: string
  onClose: () => void
  onSuccess: () => void
}

export default function QrScanner({ missionId, userId, onClose, onSuccess }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const scannerRef  = useRef<any>(null)
  const [status, setStatus]   = useState<'scanning' | 'success' | 'error'>('scanning')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true

    async function init() {
      const QrScannerLib = (await import('qr-scanner')).default
      if (!videoRef.current || !active) return

      scannerRef.current = new QrScannerLib(
        videoRef.current,
        async (result: { data: string }) => {
          if (!active) return
          active = false
          scannerRef.current?.stop()

          // Send the token to our validation endpoint
          try {
            const res = await fetch('/api/qr-validate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: result.data, missionId, userId }),
            })
            const json = await res.json()
            if (res.ok && json.success) {
              setStatus('success')
              setMessage(`+${json.pointsEarned} pts — ${json.missionTitle}`)
              setTimeout(onSuccess, 1800)
            } else {
              setStatus('error')
              setMessage(json.error ?? 'Invalid QR code. Ask staff for help.')
            }
          } catch {
            setStatus('error')
            setMessage('Network error. Please try again.')
          }
        },
        { returnDetailedScanResult: true, highlightScanRegion: true, highlightCodeOutline: true }
      )

      await scannerRef.current.start()
    }

    init()
    return () => {
      active = false
      scannerRef.current?.destroy()
    }
  }, [missionId, userId, onSuccess])

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-safe">
        <button onClick={onClose} className="text-white text-sm px-3 py-1.5 rounded-lg bg-white/10">
          Cancel
        </button>
        <p className="text-white font-semibold text-sm">Scan QR Code</p>
        <div className="w-16" />
      </div>

      {/* Camera view */}
      <div className="flex-1 relative">
        <video ref={videoRef} className="w-full h-full object-cover" />

        {/* Scan frame overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-56 h-56 border-2 border-[#f5c842] rounded-2xl" />
        </div>

        {/* Status overlay */}
        {status !== 'scanning' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center">
            <div className="text-5xl mb-4">
              {status === 'success' ? '✅' : '❌'}
            </div>
            <p className="text-white font-semibold text-lg mb-2">
              {status === 'success' ? 'Got it!' : 'Hmm…'}
            </p>
            <p className="text-gray-300 text-sm">{message}</p>
            {status === 'error' && (
              <button
                onClick={() => { setStatus('scanning'); setMessage('') }}
                className="mt-4 bg-[#f5c842] text-black font-semibold px-6 py-2 rounded-xl text-sm"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>

      <p className="text-gray-500 text-xs text-center py-4 px-6">
        Ask a staff member to show you their QR code to complete this mission.
      </p>
    </div>
  )
}
