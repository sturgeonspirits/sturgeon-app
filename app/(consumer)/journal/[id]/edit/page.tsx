import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import JournalEditForm from '@/components/journal/JournalEditForm'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditJournalEntryPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const service = createServiceClient()

  // Fetch the entry — must belong to this user
  const { data: entry } = await service
    .from('tasting_logs')
    .select('id, user_id, spirit_name, spirit_category, nose, palate, finish, overall_notes, rating, visited_at')
    .eq('id', id)
    .maybeSingle()

  if (!entry) notFound()
  if (entry.user_id !== user.id) redirect('/journal')

  // Load active recipes for the picker
  const { data: recipes } = await service
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
          Edit Entry
        </h1>
        <p className="text-sm text-[#7E613F] font-body mt-1">Changes won&apos;t affect your points</p>
      </div>
      <JournalEditForm
        entry={entry}
        recipes={recipes ?? []}
        userId={user.id}
      />
    </div>
  )
}
