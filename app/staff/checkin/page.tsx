/**
 * /staff/checkin — fullscreen daily check-in QR for staff display.
 * Staff can prop up a tablet showing this page so customers self-scan.
 * Also has a "Manual check-in" button for granting points retroactively.
 */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDailyToken, localDate } from '@/lib/checkin-token'
import ManualCheckinForm from './ManualCheckinForm'

export default async function StaffCheckinPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff/login')

  const token       = getDailyToken()
  const today       = localDate(0)
  const checkinUrl  = `https://club.sturgeonspirits.com/checkin?t=${token}`
  const qrImageUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(checkinUrl)}&format=png&margin=10`

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center gap-8 py-8">

      {/* QR card */}
      <div className="bg-white border border-[#D4CFC3] rounded-3xl p-6 text-center space-y-4 w-full max-w-xs">
        <div>
          <p className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest">Check In</p>
          <p className="text-sm font-bold text-[#242622] mt-0.5">Spearers Club</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrImageUrl}
          alt="Check-in QR code"
          width={280}
          height={280}
          className="rounded-2xl mx-auto"
        />
        <div>
          <p className="text-lg font-bold text-[#96321F]">+15 points</p>
          <p className="text-xs text-[#9E8F7E] mt-0.5">Scan with your phone · once per day</p>
          <p className="text-[10px] text-[#9E8F7E] mt-1">Rotates at midnight · {today}</p>
        </div>
      </div>

      {/* Manual check-in for retroactive grants */}
      <div className="w-full max-w-xs">
        <p className="text-xs font-semibold text-[#7E613F] uppercase tracking-widest text-center mb-3">
          Manual Check-In
        </p>
        <ManualCheckinForm staffId={user.id} />
      </div>
    </div>
  )
}
