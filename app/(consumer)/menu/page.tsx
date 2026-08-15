// ─────────────────────────────────────────────
// Changelog
//   v2026-08-01.1 — Menu now reads the published Menu_Public / Menu_Event tabs
//                   via lib/sheet-menu.ts instead of the Supabase `recipes`
//                   table, matching the v3.0 architecture used by the public
//                   and Ready Room menus. Ends the drift where the app showed
//                   the last sync's data while the website showed the sheet's.
//
//                   Sort order is unchanged (section_sort_order -> sort_order
//                   -> name); it is now applied in sortRecipes() rather than
//                   by the database. Auth gating and the empty state are also
//                   unchanged, and the empty state now doubles as the failure
//                   state when the sheet is unreachable.
// ─────────────────────────────────────────────

import { getAuthUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MenuSearch from '@/components/menu/MenuSearch'
import { RocksGlass } from '@/components/icons/brand'
import { fetchSheetMenu } from '@/lib/sheet-menu'

export default async function MenuPage() {
  // Supabase still owns identity — only the menu data moved to the sheet.
  const { user } = await getAuthUser()
  if (!user) redirect('/auth/login')

  const { regularRecipes, eventRecipes, featuredSection, failed } =
    await fetchSheetMenu()

  const isEmpty = regularRecipes.length === 0 && eventRecipes.length === 0

  return (
    <div className="max-w-lg mx-auto px-4 pb-10">
      <div className="pt-10 mb-6">
        <h1 className="font-display text-2xl font-bold text-[#242622] uppercase tracking-wide">
          Cocktail Menu
        </h1>
        <p className="text-sm text-[#7E613F] mt-1">crafted in Oshkosh</p>
      </div>

      {isEmpty ? (
        <div className="text-center py-20 bg-[#FFFFFF] rounded-2xl border border-[#D4CFC3]">
          <RocksGlass size={52} className="text-[#D4CFC3] mx-auto mb-4" />
          <p className="font-semibold text-[#242622] mb-1">
            {failed ? 'Menu unavailable' : 'Menu coming soon'}
          </p>
          <p className="text-sm text-[#7E613F]">
            {failed
              ? 'We could not reach the menu just now — pull to refresh in a moment'
              : 'The cocktail menu will appear here shortly'}
          </p>
        </div>
      ) : (
        <MenuSearch
          regularRecipes={regularRecipes}
          eventRecipes={eventRecipes}
          featuredSection={featuredSection}
        />
      )}
    </div>
  )
}
