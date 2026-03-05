import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 1000

async function fetchAllRows(query) {
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

export async function GET(request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'Server misconfiguration: missing env vars' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const query = supabase
    .from('prissammenligning')
    .select('id, produkt, merke, varenummer, kategori, sist_oppdatert')
    .order('kategori')
    .order('merke')
    .order('produkt')

  const { data, error } = await fetchAllRows(query)

  if (error) {
    console.error('Supabase error:', error)
    return Response.json({ error: 'Failed to fetch data' }, { status: 500 })
  }

  return Response.json(data, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
}
