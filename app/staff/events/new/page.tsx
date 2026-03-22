import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EventTypeForm from '../EventTypeForm'

export default async function NewEventTypePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff/login')

  return (
    <div className="py-4 max-w-lg">
      <h1 className="text-xl font-bold text-[#242622] mb-1">New Weekly Event</h1>
      <p className="text-sm text-[#7E613F] mb-6">Add a recurring weekly event to the Events tab</p>
      <EventTypeForm existing={null} />
    </div>
  )
}
