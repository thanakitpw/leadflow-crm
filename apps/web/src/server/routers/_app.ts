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
import { dashboardRouter } from '@/server/routers/dashboard'
import { reportRouter } from '@/server/routers/report'
import { activityRouter } from '@/server/routers/activity'

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
  // Phase 4: Dashboard + Reports + Activity
  dashboard: dashboardRouter,
  report: reportRouter,
  activity: activityRouter,
})

export type AppRouter = typeof appRouter
