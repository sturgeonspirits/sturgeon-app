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
        Manually register a customer so they can earn points. They'll receive a magic-link
        sign-in email and their profile will be ready when they log in.
      </p>
      <NewCustomerForm />
    </div>
  )
}
