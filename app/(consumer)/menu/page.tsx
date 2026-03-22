import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function MenuPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name, menu_section, menu_ingredients, price, flavor_tags, glassware, show_on_menu')
    .eq('is_active', true)
    .eq('show_on_menu', true)
    .order('menu_section')
    .order('sort_order')
    .order('name')

  // Group by section
  const sections: Record<string, typeof recipes> = {}
  for (const r of recipes ?? []) {
    const s = r.menu_section ?? 'Other'
    if (!sections[s]) sections[s] = []
    sections[s]!.push(r)
  }
  const sectionNames = Object.keys(sections).sort()

  return (
    <div className="max-w-lg mx-auto px-4 pb-10">
      <div className="pt-10 mb-6">
        <h1 className="font-display text-2xl font-bold text-[#242622] uppercase tracking-wide">
          Cocktail Menu
        </h1>
        <p className="text-sm text-[#7E613F] mt-1">
          {(recipes ?? []).length} cocktails · crafted in Oshkosh
        </p>
      </div>

      {sectionNames.length === 0 ? (
        <div className="text-center py-20 bg-[#FFFFFF] rounded-2xl border border-[#D4CFC3]">
          <p className="text-5xl mb-4">🍹</p>
          <p className="font-semibold text-[#242622] mb-1">Menu coming soon</p>
          <p className="text-sm text-[#7E613F]">Staff will sync the cocktail menu shortly</p>
        </div>
      ) : (
        <div className="space-y-8">
          {sectionNames.map(section => (
            <section key={section}>
              {/* Section header */}
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-bold text-[#96321F] uppercase tracking-[0.18em]">{section}</p>
                <div className="flex-1 h-px bg-[#D4CFC3]" />
              </div>

              <div className="space-y-2">
                {sections[section]!.map(r => (
                  <div
                    key={r.id}
                    className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#242622]">{r.name}</p>
                        {r.menu_ingredients && (
                          <p className="text-xs text-[#7E613F] mt-1 leading-relaxed">
                            {r.menu_ingredients}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {r.glassware && (
                            <span className="text-[10px] bg-[#EDE9DC] text-[#7E613F] px-2 py-0.5 rounded-full">
                              {r.glassware}
                            </span>
                          )}
                          {(r.flavor_tags ?? []).slice(0, 3).map((tag: string) => (
                            <span
                              key={tag}
                              className="text-[10px] bg-[#87A67F]/12 text-[#87A67F] px-2 py-0.5 rounded-full font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      {r.price && (
                        <p className="text-base font-bold text-[#242622] shrink-0">
                          ${Number(r.price).toFixed(0)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
