// ─────────────────────────────────────────────
// Changelog
//   v2026-07-13.1 — New shared helper. PostgREST caps every response at its
//                   max-rows setting (default 1,000) regardless of .limit(),
//                   which silently truncates large fetches (caused the
//                   2026-07-13 Toast sync duplicate incident). Any query that
//                   can return >1,000 rows must paginate through this helper.
// ─────────────────────────────────────────────

/**
 * Fetch every row of a query by paginating with .range() in 1,000-row pages.
 * The builder receives (from, to) and must apply .range(from, to) and a stable
 * .order() so pages don't shift between requests.
 *
 * Example:
 *   const rows = await fetchAllRows((from, to) => service
 *     .from('profiles').select('id, email').order('id').range(from, to))
 */
export async function fetchAllRows(
  query: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>
): Promise<any[]> {
  const PAGE = 1000
  const all: any[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    all.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return all
}
