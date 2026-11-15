const PAGE_SIZE = 1000

// Henter alle rader side for side. Spørringen må ha en entydig sortering
// (f.eks. avsluttet med .order('id')); uten det kan Postgres returnere radene
// i ulik rekkefølge fra side til side, slik at rader dupliseres eller mangler.
export async function fetchAllRows(query) {
  const allRows = []
  let from = 0
  while (true) {
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    allRows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return { data: allRows, error: null }
}
