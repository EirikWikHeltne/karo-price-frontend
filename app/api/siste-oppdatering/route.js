import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Get the most recent scan date from prishistorikk
  const { data, error } = await supabase
    .from('prishistorikk')
    .select('dato')
    .order('dato', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Supabase error:', error)
    return Response.json({ error: 'Failed to fetch latest scan date' }, { status: 500 })
  }

  const dato = data?.[0]?.dato ?? null

  return Response.json({ dato }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
}
