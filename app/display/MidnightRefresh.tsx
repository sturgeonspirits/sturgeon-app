'use client'

import { useEffect } from 'react'

/**
 * Invisible client component that reloads the page at midnight Chicago time
 * so the QR code (which rotates daily) stays current without staff intervention.
 */
export default function MidnightRefresh() {
  useEffect(() => {
    // Calculate milliseconds until next midnight in America/Chicago
    function msUntilMidnightChicago() {
      const now = new Date()
      // Get today's date string in Chicago time
      const chicagoDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
      // Build a Date representing midnight tonight (Chicago), adding 1 minute buffer
      const [y, m, d] = chicagoDateStr.split('-').map(Number)
      const tomorrowChicago = new Date(y, m - 1, d + 1, 0, 1, 0) // 00:01 AM tomorrow
      // toLocaleDateString gives us local date, but we need UTC equivalent
      // Use the offset between Chicago midnight and UTC
      const chicagoMidnight = new Date(
        tomorrowChicago.toLocaleString('en-US', { timeZone: 'America/Chicago' })
      )
      // Compute via the difference approach
      const chicagoOffset = now.getTime() - new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' })).getTime()
      const localMidnight = tomorrowChicago.getTime() + chicagoOffset
      return Math.max(localMidnight - Date.now(), 60_000) // at least 1 min
    }

    const ms = msUntilMidnightChicago()
    const t = setTimeout(() => window.location.reload(), ms)
    return () => clearTimeout(t)
  }, [])

  return null
}
