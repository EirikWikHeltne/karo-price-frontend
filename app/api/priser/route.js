import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase env vars:', {
      url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    })
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
