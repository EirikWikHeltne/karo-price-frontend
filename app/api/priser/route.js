import { supabaseServer as supabase } from '@/lib/supabaseServer'

export async function GET(request) {
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
    const safe = search.replace(/[(),.\\*"]/g, '')
    if (safe) {
      query = query.or(`produkt.ilike.%${safe}%,merke.ilike.%${safe}%,varenummer.ilike.%${safe}%`)
    }
  }

  const { data, error } = await query

  if (error) {
    console.error('Supabase error:', error)
    return Response.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
  return Response.json(data)
}
