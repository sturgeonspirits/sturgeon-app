import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import JournalForm from '@/components/journal/JournalForm'

export default async function NewJournalEntryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Load all active spirits from the menu — grouped by house vs. other
  const { data: spirits } = await supabase
    .from('spirits')
    .select('id, name, category, subcategory, is_house')
    .eq('is_active', true)
    .order('is_house', { ascending: false })
    .order('category')
    .order('name')

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="pt-4 mb-6">
        <a href="/journal" className="text-sm text-[#7E613F] hover:text-[#96321F] mb-4 inline-block transition-colors">
          ← Back to Journal
        </a>
        <h1 className="font-display text-2xl font-bold text-[#242622] uppercase tracking-wide">
          New Tasting Entry
        </h1>
        <p className="text-sm text-[#7E613F] font-body mt-1">Earn 75 pts for logging a tasting</p>
      </div>
      <JournalForm spirits={spirits ?? []} userId={user.id} />
    </div>
  )
}
