import { createClient } from '@supabase/supabase-js'

// Cliente com service role — usar apenas em rotas de servidor (nunca no browser)
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
