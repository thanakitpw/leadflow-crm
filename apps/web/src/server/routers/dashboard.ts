import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import { createClient } from '@/lib/supabase/server'

// ============================================================
// Helpers
// ============================================================

async function verifyWorkspaceMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  workspaceId: string,
) {
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'คุณไม่มีสิทธิ์เข้าถึง workspace นี้',
    })
  }

  return membership
}

// ============================================================
// Router
// ============================================================

export const dashboardRouter = router({
  // ----------------------------------------------------------
  // getStats — ดึง stats รวมของ workspace
  // return: totalLeads, leadsWithEmail, totalCampaigns,
  //         emailSent, emailOpened, emailClicked, emailBounced,
  //         openRate, clickRate
  // ----------------------------------------------------------
  getStats: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      // query ทั้ง 3 tables พร้อมกัน
      const [leadsResult, campaignsResult, eventsResult] = await Promise.all([
        supabase
          .from('leads')
          .select('id, status, email', { count: 'exact' })
          .eq('workspace_id', input.workspaceId),

        supabase
          .from('campaigns')
          .select('id, status', { count: 'exact' })
          .eq('workspace_id', input.workspaceId),

        supabase
          .from('email_events')
          .select('event_type')
          .eq('workspace_id', input.workspaceId),
      ])

      if (leadsResult.error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถดึงข้อมูล leads ได้',
          cause: leadsResult.error,
        })
      }

      if (campaignsResult.error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถดึงข้อมูล campaigns ได้',
          cause: campaignsResult.error,
        })
      }

      if (eventsResult.error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถดึงข้อมูล email events ได้',
          cause: eventsResult.error,
        })
      }

      // คำนวณ lead stats
      const leads = leadsResult.data ?? []
      const totalLeads = leadsResult.count ?? 0
      const leadsWithEmail = leads.filter((l) => l.email && l.email !== '').length

      // คำนวณ campaign stats
      const campaigns = campaignsResult.data ?? []
      const totalCampaigns = campaignsResult.count ?? 0
      const activeCampaigns = campaigns.filter((c) => c.status === 'sending').length
      const completedCampaigns = campaigns.filter((c) => c.status === 'sent' || c.status === 'completed').length

      // คำนวณ email event stats
      const events = eventsResult.data ?? []
      let emailSent = 0
      let emailDelivered = 0
      let emailOpened = 0
      let emailClicked = 0
      let emailBounced = 0
      let emailComplained = 0

      for (const event of events) {
        switch (event.event_type) {
          case 'sent':
            emailSent++
            break
          case 'delivered':
            emailDelivered++
            break
          case 'opened':
            emailOpened++
            break
          case 'clicked':
            emailClicked++
            break
          case 'bounced':
            emailBounced++
            break
          case 'complained':
            emailComplained++
            break
        }
      }

      // คำนวณ rates (ใช้ delivered เป็นฐาน ถ้าไม่มีให้ใช้ sent)
      const baseCount = emailDelivered > 0 ? emailDelivered : emailSent
      const openRate = baseCount > 0 ? Math.round((emailOpened / baseCount) * 100 * 10) / 10 : 0
      const clickRate = baseCount > 0 ? Math.round((emailClicked / baseCount) * 100 * 10) / 10 : 0
      const bounceRate = emailSent > 0 ? Math.round((emailBounced / emailSent) * 100 * 10) / 10 : 0

      return {
        leads: {
          total: totalLeads,
          withEmail: leadsWithEmail,
          withoutEmail: totalLeads - leadsWithEmail,
          emailCoverageRate:
            totalLeads > 0 ? Math.round((leadsWithEmail / totalLeads) * 100 * 10) / 10 : 0,
        },
        campaigns: {
          total: totalCampaigns,
          active: activeCampaigns,
          completed: completedCampaigns,
        },
        emails: {
          sent: emailSent,
          delivered: emailDelivered,
          opened: emailOpened,
          clicked: emailClicked,
          bounced: emailBounced,
          complained: emailComplained,
          openRate,
          clickRate,
          bounceRate,
        },
      }
    }),

  // ----------------------------------------------------------
  // getRecentActivity — ดึง activity_feed ล่าสุด
  // ----------------------------------------------------------
  getRecentActivity: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { data, error } = await supabase
        .from('activity_feed')
        .select(
          `
          id, action, resource_type, resource_id, resource_name,
          metadata, occurred_at,
          profiles ( id, full_name, avatar_url )
        `,
        )
        .eq('workspace_id', input.workspaceId)
        .order('occurred_at', { ascending: false })
        .limit(input.limit)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถดึง activity feed ได้',
          cause: error,
        })
      }

      return data ?? []
    }),

  // ----------------------------------------------------------
  // getAgencyOverview — stats รวมของทุก workspace ที่ user เป็น member
  // ใช้สำหรับ Agency Admin overview page
  // ----------------------------------------------------------
  getAgencyOverview: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await createClient()

    // ดึง workspaces ที่ user เป็น member ทั้งหมด
    const { data: memberships, error: memberError } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', ctx.user.id)

    if (memberError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'ไม่สามารถดึงข้อมูล workspaces ได้',
        cause: memberError,
      })
    }

    const workspaceIds = (memberships ?? []).map((m) => m.workspace_id)

    if (workspaceIds.length === 0) {
      return {
        totalWorkspaces: 0,
        totalLeads: 0,
        totalLeadsWithEmail: 0,
        totalCampaigns: 0,
        totalEmailSent: 0,
        totalEmailOpened: 0,
        totalEmailClicked: 0,
        overallOpenRate: 0,
        overallClickRate: 0,
      }
    }

    // query stats ทั้ง 3 tables พร้อมกันสำหรับทุก workspace
    const [leadsResult, campaignsResult, eventsResult] = await Promise.all([
      supabase
        .from('leads')
        .select('id, email', { count: 'exact' })
        .in('workspace_id', workspaceIds),

      supabase
        .from('campaigns')
        .select('id', { count: 'exact' })
        .in('workspace_id', workspaceIds),

      supabase
        .from('email_events')
        .select('event_type')
        .in('workspace_id', workspaceIds),
    ])

    // คำนวณ aggregate stats
    const leads = leadsResult.data ?? []
    const totalLeads = leadsResult.count ?? 0
    const totalLeadsWithEmail = leads.filter((l) => l.email && l.email !== '').length

    const totalCampaigns = campaignsResult.count ?? 0

    let totalEmailSent = 0
    let totalEmailDelivered = 0
    let totalEmailOpened = 0
    let totalEmailClicked = 0

    for (const event of eventsResult.data ?? []) {
      if (event.event_type === 'sent') totalEmailSent++
      if (event.event_type === 'delivered') totalEmailDelivered++
      if (event.event_type === 'opened') totalEmailOpened++
      if (event.event_type === 'clicked') totalEmailClicked++
    }

    const baseCount = totalEmailDelivered > 0 ? totalEmailDelivered : totalEmailSent
    const overallOpenRate =
      baseCount > 0 ? Math.round((totalEmailOpened / baseCount) * 100 * 10) / 10 : 0
    const overallClickRate =
      baseCount > 0 ? Math.round((totalEmailClicked / baseCount) * 100 * 10) / 10 : 0

    return {
      totalWorkspaces: workspaceIds.length,
      totalLeads,
      totalLeadsWithEmail,
      totalCampaigns,
      totalEmailSent,
      totalEmailOpened,
      totalEmailClicked,
      overallOpenRate,
      overallClickRate,
    }
  }),

  // ----------------------------------------------------------
  // getPerWorkspaceStats — stats แยกตาม workspace
  // ใช้สำหรับ Agency view ที่แสดงแต่ละ client workspace
  // ----------------------------------------------------------
  getPerWorkspaceStats: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await createClient()

    // ดึง workspaces ที่ user เป็น member
    const { data: memberships, error: memberError } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', ctx.user.id)

    if (memberError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'ไม่สามารถดึงข้อมูล workspaces ได้',
        cause: memberError,
      })
    }

    const workspaceIds = (memberships ?? []).map((m) => m.workspace_id)

    if (workspaceIds.length === 0) {
      return []
    }

    // ดึง workspace details + stats พร้อมกัน
    const [workspacesResult, leadsResult, campaignsResult, eventsResult] = await Promise.all([
      supabase
        .from('workspaces')
        .select('id, name, type, created_at')
        .in('id', workspaceIds)
        .order('created_at', { ascending: false }),

      supabase
        .from('leads')
        .select('workspace_id, email')
        .in('workspace_id', workspaceIds),

      supabase
        .from('campaigns')
        .select('workspace_id, status')
        .in('workspace_id', workspaceIds),

      supabase
        .from('email_events')
        .select('workspace_id, event_type')
        .in('workspace_id', workspaceIds),
    ])

    if (workspacesResult.error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'ไม่สามารถดึงข้อมูล workspace stats ได้',
        cause: workspacesResult.error,
      })
    }

    // สร้าง stats map ตาม workspace_id
    const statsMap: Record<
      string,
      {
        totalLeads: number
        leadsWithEmail: number
        totalCampaigns: number
        emailSent: number
        emailOpened: number
        emailClicked: number
      }
    > = {}

    for (const ws of workspacesResult.data ?? []) {
      statsMap[ws.id] = {
        totalLeads: 0,
        leadsWithEmail: 0,
        totalCampaigns: 0,
        emailSent: 0,
        emailOpened: 0,
        emailClicked: 0,
      }
    }

    for (const lead of leadsResult.data ?? []) {
      if (!statsMap[lead.workspace_id]) continue
      statsMap[lead.workspace_id].totalLeads++
      if (lead.email && lead.email !== '') {
        statsMap[lead.workspace_id].leadsWithEmail++
      }
    }

    for (const campaign of campaignsResult.data ?? []) {
      if (!statsMap[campaign.workspace_id]) continue
      statsMap[campaign.workspace_id].totalCampaigns++
    }

    for (const event of eventsResult.data ?? []) {
      if (!statsMap[event.workspace_id]) continue
      if (event.event_type === 'sent') statsMap[event.workspace_id].emailSent++
      if (event.event_type === 'opened') statsMap[event.workspace_id].emailOpened++
      if (event.event_type === 'clicked') statsMap[event.workspace_id].emailClicked++
    }

    // รวม workspace info + stats
    return (workspacesResult.data ?? []).map((ws) => {
      const stats = statsMap[ws.id] ?? {
        totalLeads: 0,
        leadsWithEmail: 0,
        totalCampaigns: 0,
        emailSent: 0,
        emailOpened: 0,
        emailClicked: 0,
      }

      const openRate =
        stats.emailSent > 0
          ? Math.round((stats.emailOpened / stats.emailSent) * 100 * 10) / 10
          : 0

      return {
        ...ws,
        stats: {
          ...stats,
          openRate,
        },
      }
    })
  }),
})
