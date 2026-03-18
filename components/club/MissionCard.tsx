'use client'

import { useState } from 'react'
import type { Mission } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'
import QrScanner from './QrScanner'

interface Props {
  mission: Mission
  completed: boolean
  userId: string
}

export default function MissionCard({ mission, completed, userId }: Props) {
  const [showScanner, setShowScanner] = useState(false)

  const triggerLabel: Record<string, string> = {
    qr_scan:            'Scan QR code at the bar',
    journal_entry:      'Log a tasting entry',
    event_attendance:   'Awarded at events',
    manual_staff:       'Staff-awarded',
    toast_purchase:     'Purchase at the bar',
    challenge_completion: 'Complete challenge',
  }

  return (
    <>
      <div
        className={cn(
          'bg-[#1a1a1a] border rounded-xl p-4 transition-all',
          completed
            ? 'border-[#2e2e2e] opacity-50'
            : 'border-[#2e2e2e] hover:border-[#f5c842]/30'
        )}
      >
        <div className="flex items-center gap-3">
          <span className={cn('text-2xl', completed && 'grayscale')}>{mission.icon}</span>
          <div className="flex-1 min-w-0">
            <p className={cn('font-semibold text-sm truncate', completed ? 'text-gray-600' : 'text-white')}>
              {mission.title}
            </p>
            {mission.description && (
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{mission.description}</p>
            )}
            <p className="text-xs text-gray-600 mt-1">
              {triggerLabel[mission.completion_trigger] ?? mission.completion_trigger}
            </p>
          </div>
          <div className="shrink-0 text-right">
            {completed ? (
              <span className="text-[#5dbb5d] text-lg">✓</span>
            ) : (
              <div>
                <p className="text-[#f5c842] text-sm font-bold">+{mission.points}</p>
                <p className="text-xs text-gray-600">pts</p>
              </div>
            )}
          </div>
        </div>

        {/* QR scan button for qr_scan missions */}
        {!completed && mission.completion_trigger === 'qr_scan' && (
          <button
            onClick={() => setShowScanner(true)}
            className="mt-3 w-full bg-[#f5c842]/10 border border-[#f5c842]/20 text-[#f5c842] text-xs font-semibold py-2 rounded-lg hover:bg-[#f5c842]/20 transition-colors"
          >
            📷 Scan QR Code
          </button>
        )}
      </div>

      {showScanner && (
        <QrScanner
          missionId={mission.id}
          userId={userId}
          onClose={() => setShowScanner(false)}
          onSuccess={() => {
            setShowScanner(false)
            // Refresh the page to show completion — router.refresh() from parent is cleaner in production
            window.location.reload()
          }}
        />
      )}
    </>
  )
}
