import { validateDailyToken } from '@/lib/checkin-token'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CheckInButton from './CheckInButton'

const CHECKIN_POINTS = 15

export default async function CheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>
}) {
  const { t: token } = await searchParams

  // No token → show how-to instructions
  if (!token) {
    return (
      <Shell>
        <div className="w-full max-w-sm text-center space-y-5">
          <p className="text-5xl">📍</p>
          <div>
            <h1 className="text-xl font-bold text-[#242622]">Check In at the Bar</h1>
            <p className="text-sm text-[#7E613F] mt-1">Earn 15 points every time you visit.</p>
          </div>
          <div className="bg-white border border-[#D4CFC3] rounded-2xl p-4 text-left space-y-3">
            <Step n={1} text="Ask your bartender to show you the check-in QR code." />
            <Step n={2} text="Scan it with your phone camera." />
            <Step n={3} text="Tap "Check In" and collect your points!" />
          </div>
          <a href="/club" className="block text-sm text-[#9E8F7E] hover:text-[#7E613F] py-2 transition-colors">
            ← Back to my profile
          </a>
        </div>
      </Shell>
    )
  }

  // Invalid / expired token
  if (!validateDailyToken(token)) {
    return (
      <Shell>
        <div className="text-center space-y-3">
          <p className="text-4xl">🦫</p>
          <p className="font-bold text-[#242622]">QR code expired</p>
          <p className="text-sm text-[#7E613F]">
            This link is no longer valid. Ask a staff member for the latest QR code.
          </p>
          <a href="/club" className="block text-sm text-[#96321F] underline mt-2">
            Back to my profile
          </a>
        </div>
      </Shell>
    )
  }

  // Must be signed in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/auth/login?redirect=/checkin%3Ft=${token}`)
  }

  // Fetch first name for personalised greeting
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()

  const firstName = profile?.display_name?.split(' ')[0] ?? null

  return (
    <Shell>
      <div className="w-full max-w-sm space-y-6 text-center">
        <p className="text-5xl">📍</p>

        <div>
          <h1 className="text-2xl font-bold text-[#242622]">
            {firstName ? `Hey ${firstName}!` : 'Check In'}
          </h1>
          <p className="text-sm text-[#7E613F] mt-1">
            Tap below to earn <strong>{CHECKIN_POINTS} points</strong> for visiting today.
          </p>
        </div>

        <CheckInButton token={token} />
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F1F1E7] flex flex-col items-center justify-center px-6 py-12">
      {children}
    </div>
  )
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-6 h-6 rounded-full bg-[#96321F]/10 text-[#96321F] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <p className="text-sm text-[#242622]">{text}</p>
    </div>
  )
}
