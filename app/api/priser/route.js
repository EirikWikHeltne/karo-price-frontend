import { getSupabase } from '@/lib/supabaseServer'
import { fetchAllRows } from '@/lib/fetchAllRows'
import { cleanRows } from '@/lib/cleanRow'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  let supabase
  try {
    supabase = getSupabase()
  } catch {
    return Response.json({ error: 'Server misconfiguration: missing env vars' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const kategori = searchParams.get('kategori')
  const search = searchParams.get('search')

  let query = supabase
    .from('prissammenligning')
    .select('*')
    .order('kategori')
    .order('merke')

  if (kategori && kategori !== 'alle') {
    query = query.eq('kategori', kategori)
  }

  if (search) {
    // Strip characters with special meaning in PostgREST filter syntax
    const safe = search.replace(/[(),.\\*"%_]/g, '')
    if (safe) {
      query = query.or(`produkt.ilike.%${safe}%,merke.ilike.%${safe}%,varenummer.ilike.%${safe}%`)
    }
  }

  const { data, error } = await fetchAllRows(query)

  if (error) {
    console.error('Supabase error:', error)
    return Response.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
  return Response.json(cleanRows(data), {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
}
