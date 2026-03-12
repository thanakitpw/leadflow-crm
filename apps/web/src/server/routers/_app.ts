import { router, publicProcedure } from '@/server/trpc'
import { profileRouter } from '@/server/routers/profile'
import { agencyRouter } from '@/server/routers/agency'
import { workspaceRouter } from '@/server/routers/workspace'
import { memberRouter } from '@/server/routers/member'
import { leadRouter } from '@/server/routers/lead'

export const appRouter = router({
  // Health check (public)
  health: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }),

  // Sub-routers
  profile: profileRouter,
  agency: agencyRouter,
  workspace: workspaceRouter,
  member: memberRouter,
  lead: leadRouter,
})

export type AppRouter = typeof appRouter
