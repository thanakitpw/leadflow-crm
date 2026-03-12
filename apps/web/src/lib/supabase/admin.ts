import { createClient } from '@supabase/supabase-js'

/**
 * Supabase admin client ใช้ service role key
 * สำหรับ server-side operations ที่ต้องการ bypass RLS
 * เช่น webhook handlers, background jobs, sending jobs
 *
 * ห้ามใช้ใน client-side code เด็ดขาด
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable',
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
