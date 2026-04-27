// ─────────────────────────────────────────────
// Changelog
//   v2026-04-27.1 — New module. Defines the 6 flavor categories used by the
//                   consumer menu's "By Flavor" toggle and the keyword rules
//                   that map a recipe's flavor_tags (and ingredients/glassware
//                   as fallback) into one or more categories.
// ─────────────────────────────────────────────

/**
 * Flavor categories — the buckets shown on the consumer menu when the
 * user picks the "By Flavor" view. Order matters: this is the order
 * they render on the menu.
 */
export const FLAVOR_CATEGORIES = [
  'Bright & Citrusy',
  'Boozy & Spirit-Forward',
  'Fruity & Tropical',
  'Herbal & Botanical',
  'Sweet & Rich',
  'Smoky & Bitter',
] as const

export type FlavorCategory = (typeof FLAVOR_CATEGORIES)[number]

/**
 * Keyword rules — if a recipe's flavor_tags (or, as a fallback, its
 * menu_ingredients / glassware text) contains any of these substrings
 * (case-insensitive), it belongs in that category.
 *
 * A recipe can land in multiple categories — that's intentional: a
 * mezcal margarita is rightly both "Bright & Citrusy" and "Smoky & Bitter".
 */
const RULES: Record<FlavorCategory, string[]> = {
  'Bright & Citrusy': [
    'citrus', 'citrusy', 'bright', 'tart', 'sour', 'zesty',
    'lemon', 'lime', 'grapefruit', 'orange', 'yuzu',
    'refreshing', 'crisp',
  ],
  'Boozy & Spirit-Forward': [
    'boozy', 'spirit-forward', 'spirit forward', 'stirred', 'stiff',
    'strong', 'classic', 'old fashioned', 'manhattan', 'martini',
    'negroni', 'whiskey-forward', 'bourbon-forward',
  ],
  'Fruity & Tropical': [
    'fruity', 'fruit', 'tropical',
    'berry', 'strawberry', 'raspberry', 'blueberry', 'blackberry',
    'apple', 'pear', 'peach', 'apricot', 'cherry', 'plum',
    'pineapple', 'mango', 'passionfruit', 'passion fruit',
    'coconut', 'guava', 'lychee', 'banana', 'watermelon',
  ],
  'Herbal & Botanical': [
    'herbal', 'herb', 'botanical', 'floral', 'flower',
    'mint', 'basil', 'sage', 'rosemary', 'thyme', 'lavender',
    'elderflower', 'chamomile', 'hibiscus', 'cucumber',
    'gin-forward', 'garden',
  ],
  'Sweet & Rich': [
    'sweet', 'dessert', 'rich', 'creamy', 'cream',
    'chocolate', 'vanilla', 'honey', 'maple', 'caramel',
    'coffee', 'espresso', 'mocha', 'nutty', 'almond',
  ],
  'Smoky & Bitter': [
    'smoky', 'smoke', 'smokey', 'mezcal', 'peat', 'peated', 'scotch',
    'bitter', 'amaro', 'aperol', 'campari', 'fernet', 'aperitif',
    'spicy', 'spice', 'pepper', 'jalapeño', 'jalapeno', 'chili', 'chile',
  ],
}

/**
 * Return every category a recipe belongs to, in display order.
 * Empty array means it doesn't fit any category (will be bucketed
 * into "Other" in the UI so it never disappears).
 */
export function categorizeRecipe(recipe: {
  flavor_tags?: string[] | null
  menu_ingredients?: string | null
  glassware?: string | null
}): FlavorCategory[] {
  const haystack = [
    ...(recipe.flavor_tags ?? []),
    recipe.menu_ingredients ?? '',
    recipe.glassware ?? '',
  ].join(' ').toLowerCase()

  if (!haystack.trim()) return []

  const matches: FlavorCategory[] = []
  for (const cat of FLAVOR_CATEGORIES) {
    if (RULES[cat].some(kw => haystack.includes(kw))) {
      matches.push(cat)
    }
  }
  return matches
}
