import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SyncMenuButton from './SyncMenuButton'

export default async function StaffMenuPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff/login')

  const { data: recipes, count } = await supabase
    .from('recipes')
    .select('id, name, menu_section, show_on_menu, price, glassware, flavor_tags', { count: 'exact' })
    .eq('is_active', true)
    .order('menu_section')
    .order('sort_order')
    .order('name')

  // Group by section
  const sections: Record<string, typeof recipes> = {}
  for (const r of recipes ?? []) {
    const s = r.menu_section ?? 'Uncategorized'
    if (!sections[s]) sections[s] = []
    sections[s]!.push(r)
  }

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#242622]">Cocktail Menu</h1>
          <p className="text-sm text-[#7E613F] mt-0.5">
            {count ?? 0} recipes · synced from Google Sheets
          </p>
        </div>
        <SyncMenuButton />
      </div>

      {Object.keys(sections).length === 0 ? (
        <div className="text-center py-16 bg-[#FFFFFF] rounded-2xl border border-[#D4CFC3]">
          <p className="text-4xl mb-3">🍹</p>
          <p className="font-semibold text-[#242622] mb-1">No recipes yet</p>
          <p className="text-sm text-[#7E613F] mb-4">
            First, share your Google Sheet with "Anyone with link can view", then tap Sync.
          </p>
          <SyncMenuButton />
        </div>
      ) : (
        Object.entries(sections).map(([section, items]) => (
          <section key={section}>
            <h2 className="text-xs font-bold text-[#96321F] uppercase tracking-widest mb-2">
              {section} ({items!.length})
            </h2>
            <div className="space-y-1">
              {items!.map(r => (
                <div key={r.id}
                  className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl px-4 py-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#242622] truncate">{r.name}</p>
                    <p className="text-xs text-[#9E8F7E] mt-0.5">
                      {r.glassware}{r.flavor_tags?.length ? ` · ${r.flavor_tags.slice(0, 3).join(', ')}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    {r.show_on_menu && (
                      <span className="text-xs bg-[#87A67F]/15 text-[#87A67F] font-medium px-2 py-0.5 rounded-full">
                        On Menu
                      </span>
                    )}
                    {r.price && (
                      <span className="text-sm font-bold text-[#242622]">
                        ${r.price}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
