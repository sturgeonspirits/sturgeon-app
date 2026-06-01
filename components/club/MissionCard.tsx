'use client'

import { useState } from 'react'
import type { Mission } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'
import QrScanner from './QrScanner'
import { Camera } from '@/components/icons/brand'

interface Props {
  mission: Mission
  completed: boolean
  userId: string
  pendingRequest?: boolean   // already has a pending request in the queue
}

type RequestState = 'idle' | 'loading' | 'requested' | 'error'

export default function MissionCard({ mission, completed, userId, pendingRequest = false }: Props) {
  const [showScanner,   setShowScanner]   = useState(false)
  const [requestState,  setRequestState]  = useState<RequestState>(pendingRequest ? 'requested' : 'idle')
  const [requestError,  setRequestError]  = useState('')

  async function handleRequest() {
    setRequestState('loading')
    setRequestError('')
    try {
      const res = await fetch('/api/missions/request-completion', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ missionId: mission.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setRequestError(data.error ?? 'Something went wrong')
        setRequestState('error')
      } else {
        setRequestState('requested')
      }
    } catch {
      setRequestError('Network error — please try again')
      setRequestState('error')
    }
  }

  const triggerLabel: Record<string, string> = {
    qr_scan:              'Scan QR code at the distillery',
    journal_entry:        'Log a tasting entry',
    event_attendance:     'Awarded at events',
    manual_staff:         'Staff-awarded',
    toast_purchase:       'Purchase at the distillery',
    challenge_completion: 'Complete challenge',
  }

  return (
    <>
      <div
        className={cn(
          'bg-[#FFFFFF] border rounded-xl p-4 transition-all',
          completed
            ? 'border-[#D4CFC3] opacity-50'
            : 'border-[#D4CFC3] hover:border-[#96321F]/30'
        )}
      >
        <div className="flex items-center gap-3">
          <span className={cn('text-2xl', completed && 'grayscale')}>{mission.icon}</span>
          <div className="flex-1 min-w-0">
            <p className={cn('font-semibold text-sm truncate', completed ? 'text-[#7E613F]' : 'text-[#242622]')}>
              {mission.title}
            </p>
            {mission.description && (
              <p className="text-xs text-[#7E613F] mt-0.5 leading-relaxed">{mission.description}</p>
            )}
            <p className="text-xs text-[#9E8F7E] mt-1">
              {triggerLabel[mission.completion_trigger] ?? mission.completion_trigger}
            </p>
          </div>
          <div className="shrink-0 text-right">
            {completed ? (
              <span className="text-[#87A67F] text-lg">✓</span>
            ) : (
              <div>
                <p className="text-[#96321F] text-sm font-bold">+{mission.points}</p>
                <p className="text-xs text-[#7E613F]">pts</p>
              </div>
            )}
          </div>
        </div>

        {/* QR scan button for qr_scan missions */}
        {!completed && mission.completion_trigger === 'qr_scan' && (
          <button
            onClick={() => setShowScanner(true)}
            className="mt-3 w-full bg-[#96321F]/10 border border-[#96321F]/20 text-[#96321F] text-xs font-semibold py-2 rounded-lg hover:bg-[#96321F]/20 transition-colors"
          >
            <Camera size={16} className="inline mr-1.5 align-middle" />Scan QR Code
          </button>
        )}

        {/* Request button for manual_staff missions */}
        {!completed && mission.completion_trigger === 'manual_staff' && (
          <div className="mt-3">
            {requestState === 'requested' ? (
              <div className="flex items-center gap-2 bg-[#87A67F]/15 border border-[#87A67F]/30 text-[#4a7a43] text-xs font-semibold py-2 px-3 rounded-lg">
                <span>✓</span>
                <span>Request sent — staff will approve shortly</span>
              </div>
            ) : requestState === 'error' ? (
              <div>
                <p className="text-xs text-red-600 mb-1">{requestError}</p>
                <button
                  onClick={() => setRequestState('idle')}
                  className="text-xs text-[#7E613F] underline"
                >
                  Try again
                </button>
              </div>
            ) : (
              <button
                onClick={handleRequest}
                disabled={requestState === 'loading'}
                className="w-full bg-[#96321F]/10 border border-[#96321F]/20 text-[#96321F] text-xs font-semibold py-2 rounded-lg hover:bg-[#96321F]/20 disabled:opacity-50 transition-colors"
              >
                {requestState === 'loading' ? 'Sending…' : 'I did this — Request approval'}
              </button>
            )}
          </div>
        )}
      </div>

      {showScanner && (
        <QrScanner
          missionId={mission.id}
          userId={userId}
          onClose={() => setShowScanner(false)}
          onSuccess={() => {
            setShowScanner(false)
            window.location.reload()
          }}
        />
      )}
    </>
  )
}
