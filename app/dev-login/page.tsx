'use client'

import { useEffect } from 'react'

export default function DevLoginPage() {
  useEffect(() => {
    window.location.href = '/api/dev-auth'
  }, [])

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <p className="text-gray-400 text-sm">Signing in for development…</p>
    </div>
  )
}
