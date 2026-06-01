import { getAuthUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MenuSearch from '@/components/menu/MenuSearch'
import { RocksGlass } from '@/components/icons/brand'

export default async function MenuPage() {
  const { supabase, user } = await getAuthUser()
  if (!user) redirect('/auth/login')

  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name, menu_section, menu_ingredients, price, flavor_tags, glassware, show_on_menu, is_event_menu')
    .eq('is_active', true)
    .order('section_sort_order')
    .order('sort_order')
    .order('name')

  const allRecipes = recipes ?? []

  // Regular menu: show_on_menu (col B) = true
  const regularRecipes = allRecipes.filter(r => r.show_on_menu)
  // Event menu: is_event_menu (col AA) = true
  const eventRecipes   = allRecipes.filter(r => r.is_event_menu)

  return (
    <div className="max-w-lg mx-auto px-4 pb-10">
      <div className="pt-10 mb-6">
        <h1 className="font-display text-2xl font-bold text-[#242622] uppercase tracking-wide">
          Cocktail Menu
        </h1>
        <p className="text-sm text-[#7E613F] mt-1">crafted in Oshkosh</p>
      </div>

      {allRecipes.length === 0 ? (
        <div className="text-center py-20 bg-[#FFFFFF] rounded-2xl border border-[#D4CFC3]">
          <RocksGlass size={52} className="text-[#D4CFC3] mx-auto mb-4" />
          <p className="font-semibold text-[#242622] mb-1">Menu coming soon</p>
          <p className="text-sm text-[#7E613F]">Staff will sync the cocktail menu shortly</p>
        </div>
      ) : (
        <MenuSearch
          regularRecipes={regularRecipes}
          eventRecipes={eventRecipes}
        />
      )}
    </div>
  )
}
