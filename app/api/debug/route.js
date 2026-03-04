import { supabaseServer } from '../../../lib/supabaseServer'

export async function GET() {
  const info = {
    env: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) + '…',
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set (' + process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 8) + '…)' : 'MISSING',
    }
  }

  // Test 1: list tables we can see
  const { data: tables, error: tablesError } = await supabaseServer
    .from('prissammenligning')
    .select('*', { count: 'exact', head: true })

  info.tableCheck = {
    count: tables,
    error: tablesError?.message || null,
    errorCode: tablesError?.code || null,
  }

  // Test 2: grab one raw row
  const { data: sample, error: sampleError } = await supabaseServer
    .from('prissammenligning')
    .select('*')
    .limit(1)

  info.sampleRow = {
    data: sample,
    error: sampleError?.message || null,
  }

  return Response.json(info)
}
