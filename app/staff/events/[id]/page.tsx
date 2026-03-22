import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EventTypeForm from '../EventTypeForm'

export default async function EditEventTypePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff/login')

  const { id } = await params
  const isNew = id === 'new'

  let existing = null
  if (!isNew) {
    const { data } = await supabase
      .from('event_types')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (!data) redirect('/staff/events')
    existing = data
  }

  return (
    <div className="py-4 max-w-lg">
      <h1 className="text-xl font-bold text-[#242622] mb-1">
        {isNew ? 'New Weekly Event' : 'Edit Event'}
      </h1>
      <p className="text-sm text-[#7E613F] mb-6">
        {isNew ? 'Add a recurring weekly event to the Events tab' : 'Update the event details below'}
      </p>
      <EventTypeForm existing={existing} />
    </div>
  )
}
