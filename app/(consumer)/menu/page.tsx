import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MenuSearch from '@/components/menu/MenuSearch'

export default async function MenuPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name, menu_section, menu_ingredients, price, flavor_tags, glassware')
    .eq('is_active', true)
    .order('menu_section')
    .order('sort_order')
    .order('name')

  const allRecipes = recipes ?? []

  return (
    <div className="max-w-lg mx-auto px-4 pb-10">
      <div className="pt-10 mb-6">
        <h1 className="font-display text-2xl font-bold text-[#242622] uppercase tracking-wide">
          Cocktail Menu
        </h1>
        <p className="text-sm text-[#7E613F] mt-1">
          {allRecipes.length} cocktails · crafted in Oshkosh
        </p>
      </div>

      {allRecipes.length === 0 ? (
        <div className="text-center py-20 bg-[#FFFFFF] rounded-2xl border border-[#D4CFC3]">
          <p className="text-5xl mb-4">🍹</p>
          <p className="font-semibold text-[#242622] mb-1">Menu coming soon</p>
          <p className="text-sm text-[#7E613F]">Staff will sync the cocktail menu shortly</p>
        </div>
      ) : (
        <MenuSearch recipes={allRecipes} />
      )}
    </div>
  )
}
