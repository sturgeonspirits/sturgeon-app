// ─────────────────────────────────────────────
// Changelog
//   v2026-08-14.1 — Copy update: email is now optional (roster members).
// ─────────────────────────────────────────────
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewCustomerForm from '../NewCustomerForm'

export default async function NewCustomerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff/login')

  return (
    <div className="py-4 max-w-lg">
      <h1 className="text-xl font-bold text-[#242622] mb-1">Add Customer</h1>
      <p className="text-sm text-[#7E613F] mb-6">
        With an email, they get a magic-link sign-in and can earn points. Without one,
        they&rsquo;re added as a roster member — a name on the board for cribbage nights,
        no login, no points.
      </p>
      <NewCustomerForm />
    </div>
  )
}
