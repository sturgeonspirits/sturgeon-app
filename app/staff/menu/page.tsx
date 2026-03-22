import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SyncMenuButton from './SyncMenuButton'
import StaffMenuSearch from './StaffMenuSearch'

export default async function StaffMenuPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff/login')

  const { data: recipes, count } = await supabase
    .from('recipes')
    .select(
      'id, name, menu_section, show_on_menu, price, glassware, flavor_tags, menu_ingredients, ingredients, instructions, notes, author',
      { count: 'exact' }
    )
    .eq('is_active', true)
    .order('menu_section')
    .order('sort_order')
    .order('name')

  const allRecipes = (recipes ?? []) as any[]

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#242622]">Cocktail Menu</h1>
          <p className="text-sm text-[#7E613F] mt-0.5">
            {count ?? 0} recipes · synced from Google Sheets
          </p>
        </div>
        <SyncMenuButton />
      </div>

      {allRecipes.length === 0 ? (
        <div className="text-center py-16 bg-[#FFFFFF] rounded-2xl border border-[#D4CFC3]">
          <p className="text-4xl mb-3">🍹</p>
          <p className="font-semibold text-[#242622] mb-1">No recipes yet</p>
          <p className="text-sm text-[#7E613F] mb-4">
            First, share your Google Sheet with "Anyone with link can view", then tap Sync.
          </p>
          <SyncMenuButton />
        </div>
      ) : (
        <StaffMenuSearch recipes={allRecipes} />
      )}
    </div>
  )
}
