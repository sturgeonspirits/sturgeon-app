'use client'

import { useEffect } from 'react'

// Silently registers the user for push notifications after they're logged in.
// No prompt — browser handles permission. Shows no UI.
export default function PushSubscriber() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (Notification.permission === 'denied') return

    async function subscribe() {
      try {
        const reg = await navigator.serviceWorker.ready

        // Check if already subscribed
        const existing = await reg.pushManager.getSubscription()
        if (existing) {
          // Refresh registration in DB silently
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: existing.toJSON() }),
          })
          return
        }

        // Request permission if not yet granted
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
          ),
        })

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        })
      } catch (e) {
        // Non-fatal — push is optional
        console.warn('Push subscription failed:', e)
      }
    }

    // Slight delay so it doesn't run before the page settles
    const t = setTimeout(subscribe, 3000)
    return () => clearTimeout(t)
  }, [])

  return null
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}
