import { router, publicProcedure } from '@/server/trpc'
import { profileRouter } from '@/server/routers/profile'
import { agencyRouter } from '@/server/routers/agency'
import { workspaceRouter } from '@/server/routers/workspace'
import { memberRouter } from '@/server/routers/member'
import { leadRouter } from '@/server/routers/lead'
import { campaignRouter } from '@/server/routers/campaign'
import { templateRouter } from '@/server/routers/template'
import { sequenceRouter } from '@/server/routers/sequence'
import { domainRouter } from '@/server/routers/domain'

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
  campaign: campaignRouter,
  template: templateRouter,
  sequence: sequenceRouter,
  domain: domainRouter,
})

export type AppRouter = typeof appRouter
