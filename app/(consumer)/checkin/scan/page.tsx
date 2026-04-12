import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import QRScanner from '../QRScanner'

export default async function ScanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?redirect=/checkin/scan')

  // QRScanner is a full-screen client component — no shell wrapper needed
  return <QRScanner />
}
