const PAGE_SIZE = 1000

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
