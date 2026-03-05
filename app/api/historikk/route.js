import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'Server misconfiguration: missing env vars' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { searchParams } = new URL(request.url)
  const produkt = searchParams.get('produkt')
  const varenummer = searchParams.get('varenummer')
  const dager = parseInt(searchParams.get('dager') || '30', 10)

  // Try fetching from prishistorikk table
  let query = supabase
    .from('prishistorikk')
    .select('*')
    .order('dato', { ascending: true })

  if (varenummer) {
    query = query.eq('varenummer', varenummer)
  } else if (produkt) {
    const safe = produkt.replace(/[(),.\\*"]/g, '')
    if (safe) {
      query = query.ilike('produkt', `%${safe}%`)
    }
  }

  if (dager > 0) {
    const since = new Date()
    since.setDate(since.getDate() - dager)
    query = query.gte('dato', since.toISOString().slice(0, 10))
  }

  const { data, error } = await query

  if (error) {
    // If the table doesn't exist, return a helpful message
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return Response.json(
        { error: 'Prishistorikk-tabellen finnes ikke ennå', code: 'TABLE_NOT_FOUND' },
        {
          status: 404,
          headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        }
      )
    }
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
