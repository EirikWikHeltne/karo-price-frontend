import { createClient } from '@supabase/supabase-js'

// Server-only client — uses service role key to bypass RLS.
// Never import this file from client components.
export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
