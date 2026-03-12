import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { router, protectedProcedure, publicProcedure } from '@/server/trpc'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================
// Schemas
// ============================================================

const reportConfigSchema = z.object({
  show_leads: z.boolean().default(true),
  show_campaigns: z.boolean().default(true),
  show_email_stats: z.boolean().default(true),
  show_top_campaigns: z.boolean().default(true),
})

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

/** สร้าง share token แบบสุ่ม */
function generateShareToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

// ============================================================
// Router
// ============================================================

export const reportRouter = router({
  // ----------------------------------------------------------
  // list — ดึง client_reports ของ workspace
  // ----------------------------------------------------------
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const from = (input.page - 1) * input.pageSize
      const to = from + input.pageSize - 1

      const { data, error, count } = await supabase
        .from('client_reports')
        .select(
          `
          id, title, description, date_from, date_to, config,
          share_token, share_expires_at, created_at, updated_at,
          profiles ( id, full_name, avatar_url )
        `,
          { count: 'exact' },
        )
        .eq('workspace_id', input.workspaceId)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถดึงรายการ reports ได้',
          cause: error,
        })
      }

      return {
        reports: data ?? [],
        total: count ?? 0,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil((count ?? 0) / input.pageSize),
      }
    }),

  // ----------------------------------------------------------
  // getById — ดึง report detail
  // ----------------------------------------------------------
  getById: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        reportId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { data, error } = await supabase
        .from('client_reports')
        .select(
          `
          *,
          profiles ( id, full_name, avatar_url )
        `,
        )
        .eq('id', input.reportId)
        .eq('workspace_id', input.workspaceId)
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'ไม่พบ report นี้',
        })
      }

      return data
    }),

  // ----------------------------------------------------------
  // create — สร้าง report ใหม่
  // ----------------------------------------------------------
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        title: z.string().min(1).max(200),
        description: z.string().optional(),
        dateFrom: z.string().date(), // 'YYYY-MM-DD'
        dateTo: z.string().date(),   // 'YYYY-MM-DD'
        config: reportConfigSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      // ตรวจสอบ date range
      if (input.dateFrom > input.dateTo) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'date_from ต้องไม่เกิน date_to',
        })
      }

      const { data, error } = await supabase
        .from('client_reports')
        .insert({
          workspace_id: input.workspaceId,
          created_by: ctx.user.id,
          title: input.title,
          description: input.description ?? null,
          date_from: input.dateFrom,
          date_to: input.dateTo,
          config: input.config ?? {
            show_leads: true,
            show_campaigns: true,
            show_email_stats: true,
            show_top_campaigns: true,
          },
        })
        .select('*')
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถสร้าง report ได้',
          cause: error,
        })
      }

      return data
    }),

  // ----------------------------------------------------------
  // update — แก้ไข report (title, description, date range, config)
  // ----------------------------------------------------------
  update: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        reportId: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().nullable().optional(),
        dateFrom: z.string().date().optional(),
        dateTo: z.string().date().optional(),
        config: reportConfigSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      // ดึง report เดิมเพื่อตรวจสอบ date range
      const { data: existing } = await supabase
        .from('client_reports')
        .select('date_from, date_to')
        .eq('id', input.reportId)
        .eq('workspace_id', input.workspaceId)
        .single()

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ไม่พบ report นี้' })
      }

      const newDateFrom = input.dateFrom ?? existing.date_from
      const newDateTo = input.dateTo ?? existing.date_to

      if (newDateFrom > newDateTo) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'date_from ต้องไม่เกิน date_to',
        })
      }

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (input.title !== undefined) updateData.title = input.title
      if (input.description !== undefined) updateData.description = input.description
      if (input.dateFrom !== undefined) updateData.date_from = input.dateFrom
      if (input.dateTo !== undefined) updateData.date_to = input.dateTo
      if (input.config !== undefined) updateData.config = input.config

      const { data, error } = await supabase
        .from('client_reports')
        .update(updateData)
        .eq('id', input.reportId)
        .eq('workspace_id', input.workspaceId)
        .select('*')
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถแก้ไข report ได้',
          cause: error,
        })
      }

      return data
    }),

  // ----------------------------------------------------------
  // delete — ลบ report
  // ----------------------------------------------------------
  delete: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        reportId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      const membership = await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      // เฉพาะ agency_admin เท่านั้นที่ลบ report ได้
      if (membership.role !== 'agency_admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'เฉพาะ Admin เท่านั้นที่สามารถลบ report ได้',
        })
      }

      const { error } = await supabase
        .from('client_reports')
        .delete()
        .eq('id', input.reportId)
        .eq('workspace_id', input.workspaceId)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถลบ report ได้',
          cause: error,
        })
      }

      return { success: true, deletedId: input.reportId }
    }),

  // ----------------------------------------------------------
  // getByToken — PUBLIC endpoint
  // ดึง report ผ่าน share_token โดยไม่ต้อง login
  // ใช้ publicProcedure + service client เพื่อ bypass RLS
  // ----------------------------------------------------------
  getByToken: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      // ใช้ admin client เพราะ report มี RLS ที่ต้องการ auth
      // แต่ public viewer ไม่มี session — service role bypass RLS ได้
      const supabase = createAdminClient()

      const { data, error } = await supabase
        .from('client_reports')
        .select(
          `
          id, title, description, date_from, date_to, config,
          share_token, share_expires_at, workspace_id, created_at
        `,
        )
        .eq('share_token', input.token)
        .maybeSingle()

      if (error || !data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'ไม่พบ report หรือ link ไม่ถูกต้อง',
        })
      }

      // ตรวจสอบวันหมดอายุ
      if (data.share_expires_at && new Date(data.share_expires_at) < new Date()) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Link รายงานนี้หมดอายุแล้ว',
        })
      }

      return data
    }),

  // ----------------------------------------------------------
  // getData — ดึง aggregate data ของ report (ใช้ date range จาก report)
  // ----------------------------------------------------------
  getData: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        reportId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      // ดึง report เพื่อรู้ date range
      const { data: report, error: reportError } = await supabase
        .from('client_reports')
        .select('date_from, date_to, config')
        .eq('id', input.reportId)
        .eq('workspace_id', input.workspaceId)
        .single()

      if (reportError || !report) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'ไม่พบ report นี้',
        })
      }

      // แปลง date string เป็น ISO datetime
      const dateFromISO = `${report.date_from}T00:00:00.000Z`
      const dateToISO = `${report.date_to}T23:59:59.999Z`

      // query stats ในช่วง date range พร้อมกัน
      const [leadsResult, campaignsResult, eventsResult] = await Promise.all([
        supabase
          .from('leads')
          .select('id, email, status', { count: 'exact' })
          .eq('workspace_id', input.workspaceId)
          .gte('created_at', dateFromISO)
          .lte('created_at', dateToISO),

        supabase
          .from('campaigns')
          .select('id, name, status, total_recipients, created_at')
          .eq('workspace_id', input.workspaceId)
          .gte('created_at', dateFromISO)
          .lte('created_at', dateToISO)
          .order('created_at', { ascending: false }),

        supabase
          .from('email_events')
          .select('event_type, campaign_id')
          .eq('workspace_id', input.workspaceId)
          .gte('occurred_at', dateFromISO)
          .lte('occurred_at', dateToISO),
      ])

      // คำนวณ lead stats
      const leads = leadsResult.data ?? []
      const totalLeads = leadsResult.count ?? 0
      const leadsWithEmail = leads.filter((l) => l.email && l.email !== '').length
      const leadsByStatus = leads.reduce<Record<string, number>>((acc, lead) => {
        acc[lead.status] = (acc[lead.status] ?? 0) + 1
        return acc
      }, {})

      // คำนวณ email event stats
      const events = eventsResult.data ?? []
      let emailSent = 0
      let emailDelivered = 0
      let emailOpened = 0
      let emailClicked = 0
      let emailBounced = 0

      // per-campaign stats map
      const campaignEventMap: Record<string, { sent: number; opened: number; clicked: number; bounced: number }> = {}

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
        }

        // นับ per-campaign stats
        if (event.campaign_id) {
          if (!campaignEventMap[event.campaign_id]) {
            campaignEventMap[event.campaign_id] = { sent: 0, opened: 0, clicked: 0, bounced: 0 }
          }
          if (event.event_type === 'sent') campaignEventMap[event.campaign_id].sent++
          if (event.event_type === 'opened') campaignEventMap[event.campaign_id].opened++
          if (event.event_type === 'clicked') campaignEventMap[event.campaign_id].clicked++
          if (event.event_type === 'bounced') campaignEventMap[event.campaign_id].bounced++
        }
      }

      const baseCount = emailDelivered > 0 ? emailDelivered : emailSent
      const openRate = baseCount > 0 ? Math.round((emailOpened / baseCount) * 100 * 10) / 10 : 0
      const clickRate = baseCount > 0 ? Math.round((emailClicked / baseCount) * 100 * 10) / 10 : 0

      // top performing campaigns (เรียงตาม open rate)
      const campaigns = campaignsResult.data ?? []
      const campaignsWithStats = campaigns
        .map((c) => {
          const cStats = campaignEventMap[c.id] ?? { sent: 0, opened: 0, clicked: 0, bounced: 0 }
          const cOpenRate = cStats.sent > 0 ? Math.round((cStats.opened / cStats.sent) * 100 * 10) / 10 : 0
          const cClickRate = cStats.sent > 0 ? Math.round((cStats.clicked / cStats.sent) * 100 * 10) / 10 : 0
          return {
            id: c.id,
            name: c.name,
            status: c.status,
            totalRecipients: c.total_recipients,
            stats: { ...cStats, openRate: cOpenRate, clickRate: cClickRate },
          }
        })
        .sort((a, b) => b.stats.openRate - a.stats.openRate)

      return {
        dateFrom: report.date_from,
        dateTo: report.date_to,
        config: report.config,
        leads: {
          total: totalLeads,
          withEmail: leadsWithEmail,
          byStatus: leadsByStatus,
        },
        emails: {
          sent: emailSent,
          delivered: emailDelivered,
          opened: emailOpened,
          clicked: emailClicked,
          bounced: emailBounced,
          openRate,
          clickRate,
        },
        topCampaigns: campaignsWithStats.slice(0, 5),
        allCampaigns: campaignsWithStats,
      }
    }),

  // ----------------------------------------------------------
  // getDataByToken — PUBLIC endpoint
  // ดึง report data ผ่าน share_token สำหรับ client viewer
  // ----------------------------------------------------------
  getDataByToken: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      const supabase = createAdminClient()

      // ดึง report ผ่าน share_token
      const { data: report, error: reportError } = await supabase
        .from('client_reports')
        .select('id, workspace_id, date_from, date_to, config, share_expires_at')
        .eq('share_token', input.token)
        .maybeSingle()

      if (reportError || !report) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'ไม่พบ report หรือ link ไม่ถูกต้อง',
        })
      }

      // ตรวจสอบวันหมดอายุ
      if (report.share_expires_at && new Date(report.share_expires_at) < new Date()) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Link รายงานนี้หมดอายุแล้ว',
        })
      }

      const dateFromISO = `${report.date_from}T00:00:00.000Z`
      const dateToISO = `${report.date_to}T23:59:59.999Z`

      // query stats โดยใช้ service client (bypass RLS)
      const [leadsResult, campaignsResult, eventsResult] = await Promise.all([
        supabase
          .from('leads')
          .select('id, email, status', { count: 'exact' })
          .eq('workspace_id', report.workspace_id)
          .gte('created_at', dateFromISO)
          .lte('created_at', dateToISO),

        supabase
          .from('campaigns')
          .select('id, name, status, total_recipients')
          .eq('workspace_id', report.workspace_id)
          .gte('created_at', dateFromISO)
          .lte('created_at', dateToISO)
          .order('created_at', { ascending: false }),

        supabase
          .from('email_events')
          .select('event_type, campaign_id')
          .eq('workspace_id', report.workspace_id)
          .gte('occurred_at', dateFromISO)
          .lte('occurred_at', dateToISO),
      ])

      // คำนวณ stats (logic เดียวกับ getData)
      const leads = leadsResult.data ?? []
      const totalLeads = leadsResult.count ?? 0
      const leadsWithEmail = leads.filter((l) => l.email && l.email !== '').length
      const leadsByStatus = leads.reduce<Record<string, number>>((acc, lead) => {
        acc[lead.status] = (acc[lead.status] ?? 0) + 1
        return acc
      }, {})

      const events = eventsResult.data ?? []
      let emailSent = 0
      let emailDelivered = 0
      let emailOpened = 0
      let emailClicked = 0
      let emailBounced = 0
      const campaignEventMap: Record<string, { sent: number; opened: number; clicked: number; bounced: number }> = {}

      for (const event of events) {
        if (event.event_type === 'sent') emailSent++
        if (event.event_type === 'delivered') emailDelivered++
        if (event.event_type === 'opened') emailOpened++
        if (event.event_type === 'clicked') emailClicked++
        if (event.event_type === 'bounced') emailBounced++

        if (event.campaign_id) {
          if (!campaignEventMap[event.campaign_id]) {
            campaignEventMap[event.campaign_id] = { sent: 0, opened: 0, clicked: 0, bounced: 0 }
          }
          if (event.event_type === 'sent') campaignEventMap[event.campaign_id].sent++
          if (event.event_type === 'opened') campaignEventMap[event.campaign_id].opened++
          if (event.event_type === 'clicked') campaignEventMap[event.campaign_id].clicked++
          if (event.event_type === 'bounced') campaignEventMap[event.campaign_id].bounced++
        }
      }

      const baseCount = emailDelivered > 0 ? emailDelivered : emailSent
      const openRate = baseCount > 0 ? Math.round((emailOpened / baseCount) * 100 * 10) / 10 : 0
      const clickRate = baseCount > 0 ? Math.round((emailClicked / baseCount) * 100 * 10) / 10 : 0

      const campaigns = campaignsResult.data ?? []
      const campaignsWithStats = campaigns
        .map((c) => {
          const cStats = campaignEventMap[c.id] ?? { sent: 0, opened: 0, clicked: 0, bounced: 0 }
          const cOpenRate = cStats.sent > 0 ? Math.round((cStats.opened / cStats.sent) * 100 * 10) / 10 : 0
          const cClickRate = cStats.sent > 0 ? Math.round((cStats.clicked / cStats.sent) * 100 * 10) / 10 : 0
          return {
            id: c.id,
            name: c.name,
            status: c.status,
            totalRecipients: c.total_recipients,
            stats: { ...cStats, openRate: cOpenRate, clickRate: cClickRate },
          }
        })
        .sort((a, b) => b.stats.openRate - a.stats.openRate)

      return {
        dateFrom: report.date_from,
        dateTo: report.date_to,
        config: report.config,
        leads: {
          total: totalLeads,
          withEmail: leadsWithEmail,
          byStatus: leadsByStatus,
        },
        emails: {
          sent: emailSent,
          delivered: emailDelivered,
          opened: emailOpened,
          clicked: emailClicked,
          bounced: emailBounced,
          openRate,
          clickRate,
        },
        topCampaigns: campaignsWithStats.slice(0, 5),
      }
    }),

  // ----------------------------------------------------------
  // regenerateToken — สร้าง share_token ใหม่
  // ยกเลิก token เก่า + set token ใหม่
  // ----------------------------------------------------------
  regenerateToken: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        reportId: z.string().uuid(),
        // กำหนดวันหมดอายุ (optional — null = ไม่หมดอายุ)
        expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const newToken = generateShareToken()
      const expiresAt =
        input.expiresInDays != null
          ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
          : null

      const { data, error } = await supabase
        .from('client_reports')
        .update({
          share_token: newToken,
          share_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.reportId)
        .eq('workspace_id', input.workspaceId)
        .select('id, share_token, share_expires_at')
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถสร้าง share token ใหม่ได้',
          cause: error,
        })
      }

      return data
    }),

  // ----------------------------------------------------------
  // revokeToken — ลบ share_token (ยกเลิกการแชร์)
  // ----------------------------------------------------------
  revokeToken: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        reportId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { data, error } = await supabase
        .from('client_reports')
        .update({
          share_token: null,
          share_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.reportId)
        .eq('workspace_id', input.workspaceId)
        .select('id')
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถยกเลิก share token ได้',
          cause: error,
        })
      }

      return { success: true }
    }),
})
