export { createClient } from '@supabase/supabase-js'
export type { SupabaseClient } from '@supabase/supabase-js'

// Database types will be generated from Supabase after migrations
// For now, export a placeholder
export type Database = Record<string, never>
