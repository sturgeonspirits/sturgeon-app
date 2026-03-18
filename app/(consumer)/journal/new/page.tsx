import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import JournalForm from '@/components/journal/JournalForm'

export default async function NewJournalEntryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: spirits } = await supabase
    .from('spirits')
    .select('id, name, category, is_house')
    .eq('is_active', true)
    .order('is_house', { ascending: false })
    .order('name')

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="pt-4 mb-6">
        <a href="/journal" className="text-sm text-gray-500 hover:text-gray-300 mb-4 inline-block">
          ← Journal
        </a>
        <h1 className="text-xl font-bold text-white">New Tasting Entry</h1>
        <p className="text-sm text-gray-500 mt-1">Earn 75 pts for your first entry</p>
      </div>
      <JournalForm spirits={spirits ?? []} userId={user.id} />
    </div>
  )
}
