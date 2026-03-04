import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

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
    query = query.or(`produkt.ilike.%${search}%,merke.ilike.%${search}%,varenummer.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
