import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import MissionForm from '../MissionForm'

export default async function EditMissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const { data } = await supabase.from('missions').select('*').eq('id', id).single()
  if (!data) notFound()
  return <MissionForm existing={data} />
}
