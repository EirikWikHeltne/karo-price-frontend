import { getSupabase } from '@/lib/supabaseServer'
import { fetchAllRows } from '@/lib/fetchAllRows'

export const dynamic = 'force-dynamic'

export async function GET() {
  let supabase
  try {
    supabase = getSupabase()
  } catch {
    return Response.json({ error: 'Server misconfiguration: missing env vars' }, { status: 500 })
  }

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
