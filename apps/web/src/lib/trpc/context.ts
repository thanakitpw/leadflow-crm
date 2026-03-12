import { createClient } from '@/lib/supabase/server'
import type { Session, User } from '@supabase/supabase-js'

export type TRPCContext = {
  user: User | null
  session: Session | null
}

export async function createTRPCContext(): Promise<TRPCContext> {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return {
    user: session?.user ?? null,
    session: session ?? null,
  }
}
