import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import JournalForm from '@/components/journal/JournalForm'

export default async function NewJournalEntryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Load active recipes from the synced cocktail menu
  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name, menu_section, flavor_tags')
    .eq('is_active', true)
    .order('section_sort_order')
    .order('sort_order')
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
      <JournalForm recipes={recipes ?? []} userId={user.id} />
    </div>
  )
}
