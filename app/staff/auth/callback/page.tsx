'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function StaffCallbackPage() {
  const router = useRouter()
  const supabase = createClient()
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function handle() {
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user) {
        router.replace('/staff/login')
        return
      }

      // Ensure a profile row exists (trigger may not have fired for manually-added users)
      await supabase.from('profiles').upsert({
        id:           user.id,
        email:        user.email,
        display_name: user.email?.split('@')[0] ?? 'Staff',
      }, { onConflict: 'id', ignoreDuplicates: true })

      // Check role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile || !['staff', 'admin'].includes(profile.role ?? '')) {
        await supabase.auth.signOut()
        setErrorMsg(`Access denied. Ask Karl to set your role to "staff" in Supabase.\n\nYour user ID: ${user.id}`)
        return
      }

      router.replace('/staff')
    }

    handle()
  }, [])

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#F1F1E7] flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-[#C8BCA4] p-6 text-center space-y-4">
          <div className="text-3xl">🔒</div>
          <h2 className="font-display text-lg font-bold text-[#242622] uppercase">Access Denied</h2>
          <p className="text-sm text-[#7E613F] whitespace-pre-line">{errorMsg}</p>
          <a href="/staff/login" className="block text-sm text-[#96321F] hover:underline mt-2">← Back to login</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F1F1E7] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-[#96321F] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-[#7E613F]">Signing you in…</p>
      </div>
    </div>
  )
}
