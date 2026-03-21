'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function StaffCallbackPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function handle() {
      // Exchange the token in the URL hash for a session
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user) {
        router.replace('/staff/login?error=auth')
        return
      }

      // Verify staff role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile || !['staff', 'admin'].includes(profile.role ?? '')) {
        await supabase.auth.signOut()
        router.replace('/staff/login?error=role')
        return
      }

      router.replace('/staff')
    }

    handle()
  }, [])

  return (
    <div className="min-h-screen bg-[#F1F1E7] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-[#96321F] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-[#7E613F]">Signing you in…</p>
      </div>
    </div>
  )
}
