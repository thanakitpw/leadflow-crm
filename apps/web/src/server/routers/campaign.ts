import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import { createClient } from '@/lib/supabase/server'

// ============================================================
// Internal send helpers
// ============================================================

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? 'dev-internal-secret'

/**
 * Trigger campaign send แบบ fire-and-forget
 * เรียก internal API route เพื่อไม่บล็อก tRPC response
 */
function triggerCampaignSend(campaignId: string): void {
  void fetch(`${APP_URL}/api/internal/campaign-send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId, secret: INTERNAL_SECRET }),
  }).catch((err) => console.error('[campaign.schedule] Failed to trigger send:', err))
}

// ============================================================
// Schemas
// ============================================================

const campaignStatusSchema = z.enum(['draft', 'scheduled', 'sending', 'paused', 'completed', 'cancelled'])

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

export const campaignRouter = router({
  // ----------------------------------------------------------
  // list — ดึง campaigns ของ workspace (status filter, pagination)
  // ----------------------------------------------------------
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        status: campaignStatusSchema.optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      let query = supabase
        .from('campaigns')
        .select(
          `
          id, name, status, scheduled_at, created_at, updated_at,
          template_id, sending_domain_id,
          email_templates ( name ),
          sending_domains ( domain )
        `,
          { count: 'exact' },
        )
        .eq('workspace_id', input.workspaceId)
        .order('created_at', { ascending: false })

      if (input.status) {
        query = query.eq('status', input.status)
      }

      const from = (input.page - 1) * input.pageSize
      const to = from + input.pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถดึงรายการ campaigns ได้',
          cause: error,
        })
      }

      // ดึงสถิติ contacts สำหรับแต่ละ campaign
      const campaignIds = (data ?? []).map((c) => c.id)
      let statsMap: Record<string, { total: number; sent: number; opened: number; clicked: number; bounced: number }> = {}

      if (campaignIds.length > 0) {
        const { data: statsData } = await supabase
          .from('campaign_contacts')
          .select('campaign_id, status')
          .in('campaign_id', campaignIds)

        for (const row of statsData ?? []) {
          if (!statsMap[row.campaign_id]) {
            statsMap[row.campaign_id] = { total: 0, sent: 0, opened: 0, clicked: 0, bounced: 0 }
          }
          statsMap[row.campaign_id].total++
          if (row.status === 'sent') statsMap[row.campaign_id].sent++
          if (row.status === 'opened') statsMap[row.campaign_id].opened++
          if (row.status === 'clicked') statsMap[row.campaign_id].clicked++
          if (row.status === 'bounced') statsMap[row.campaign_id].bounced++
        }
      }

      const campaigns = (data ?? []).map((c) => ({
        ...c,
        stats: statsMap[c.id] ?? { total: 0, sent: 0, opened: 0, clicked: 0, bounced: 0 },
      }))

      return {
        campaigns,
        total: count ?? 0,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil((count ?? 0) / input.pageSize),
      }
    }),

  // ----------------------------------------------------------
  // getById — campaign detail พร้อม contacts stats
  // ----------------------------------------------------------
  getById: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        campaignId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { data, error } = await supabase
        .from('campaigns')
        .select(
          `
          *,
          email_templates ( id, name, subject, body_html ),
          sending_domains ( id, domain, status )
        `,
        )
        .eq('id', input.campaignId)
        .eq('workspace_id', input.workspaceId)
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'ไม่พบ campaign นี้',
        })
      }

      // ดึงสถิติ contacts
      const { data: statsData } = await supabase
        .from('campaign_contacts')
        .select('status')
        .eq('campaign_id', input.campaignId)

      const stats = { total: 0, sent: 0, opened: 0, clicked: 0, bounced: 0, pending: 0 }
      for (const row of statsData ?? []) {
        stats.total++
        if (row.status === 'sent') stats.sent++
        else if (row.status === 'opened') stats.opened++
        else if (row.status === 'clicked') stats.clicked++
        else if (row.status === 'bounced') stats.bounced++
        else if (row.status === 'pending') stats.pending++
      }

      return { ...data, stats }
    }),

  // ----------------------------------------------------------
  // create — สร้าง campaign
  // ----------------------------------------------------------
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        name: z.string().min(1),
        templateId: z.string().uuid().optional(),
        sendingDomainId: z.string().uuid().optional(),
        audienceFilter: z
          .object({
            tags: z.array(z.string()).optional(),
            minScore: z.number().min(0).max(100).optional(),
            maxScore: z.number().min(0).max(100).optional(),
            status: z.enum(['new', 'contacted', 'qualified', 'unqualified']).optional(),
          })
          .optional(),
        scheduledAt: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          workspace_id: input.workspaceId,
          name: input.name,
          template_id: input.templateId ?? null,
          sending_domain_id: input.sendingDomainId ?? null,
          audience_filter: input.audienceFilter ?? null,
          scheduled_at: input.scheduledAt ?? null,
          status: 'draft',
        })
        .select('*')
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถสร้าง campaign ได้',
          cause: error,
        })
      }

      return data
    }),

  // ----------------------------------------------------------
  // update — แก้ไข campaign
  // ----------------------------------------------------------
  update: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        campaignId: z.string().uuid(),
        name: z.string().min(1).optional(),
        templateId: z.string().uuid().nullable().optional(),
        sendingDomainId: z.string().uuid().nullable().optional(),
        status: campaignStatusSchema.optional(),
        scheduledAt: z.string().datetime().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (input.name !== undefined) updateData.name = input.name
      if (input.templateId !== undefined) updateData.template_id = input.templateId
      if (input.sendingDomainId !== undefined) updateData.sending_domain_id = input.sendingDomainId
      if (input.status !== undefined) updateData.status = input.status
      if (input.scheduledAt !== undefined) updateData.scheduled_at = input.scheduledAt

      const { data, error } = await supabase
        .from('campaigns')
        .update(updateData)
        .eq('id', input.campaignId)
        .eq('workspace_id', input.workspaceId)
        .select('*')
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถแก้ไข campaign ได้',
          cause: error,
        })
      }

      return data
    }),

  // ----------------------------------------------------------
  // delete — ลบ campaign (draft only)
  // ----------------------------------------------------------
  delete: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        campaignId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      // ตรวจสอบว่า campaign เป็น draft
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('status')
        .eq('id', input.campaignId)
        .eq('workspace_id', input.workspaceId)
        .maybeSingle()

      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ไม่พบ campaign นี้' })
      }

      if (campaign.status !== 'draft') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'สามารถลบได้เฉพาะ campaign ที่เป็น draft เท่านั้น',
        })
      }

      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', input.campaignId)
        .eq('workspace_id', input.workspaceId)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถลบ campaign ได้',
          cause: error,
        })
      }

      return { success: true, deletedId: input.campaignId }
    }),

  // ----------------------------------------------------------
  // getContacts — ดึง campaign_contacts (status, pagination)
  // ----------------------------------------------------------
  getContacts: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        campaignId: z.string().uuid(),
        status: z.enum(['pending', 'sent', 'opened', 'clicked', 'bounced', 'unsubscribed']).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      let query = supabase
        .from('campaign_contacts')
        .select(
          `
          id, status, sent_at, opened_at, clicked_at, bounced_at, created_at,
          leads ( id, name, email )
        `,
          { count: 'exact' },
        )
        .eq('campaign_id', input.campaignId)
        .order('created_at', { ascending: false })

      if (input.status) {
        query = query.eq('status', input.status)
      }

      const from = (input.page - 1) * input.pageSize
      const to = from + input.pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถดึงรายการ contacts ได้',
          cause: error,
        })
      }

      return {
        contacts: data ?? [],
        total: count ?? 0,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil((count ?? 0) / input.pageSize),
      }
    }),

  // ----------------------------------------------------------
  // schedule — ตั้งเวลาส่ง (เปลี่ยน status → scheduled)
  // ----------------------------------------------------------
  schedule: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        campaignId: z.string().uuid(),
        scheduledAt: z.string().datetime().optional(), // ถ้าไม่ส่ง = ส่งทันที
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { data, error } = await supabase
        .from('campaigns')
        .update({
          status: input.scheduledAt ? 'scheduled' : 'sending',
          scheduled_at: input.scheduledAt ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.campaignId)
        .eq('workspace_id', input.workspaceId)
        .select('*')
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถตั้งเวลาส่ง campaign ได้',
          cause: error,
        })
      }

      // ส่งทันทีถ้าไม่ได้ตั้งเวลา (fire and forget)
      if (!input.scheduledAt) {
        triggerCampaignSend(input.campaignId)
      }

      return data
    }),

  // ----------------------------------------------------------
  // sendNow — ส่ง campaign ทันทีจากหน้า campaign detail
  // ----------------------------------------------------------
  sendNow: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        campaignId:  z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      // ตรวจสอบ campaign และ status ก่อนส่ง
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('id, status, template_id')
        .eq('id', input.campaignId)
        .eq('workspace_id', input.workspaceId)
        .maybeSingle()

      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ไม่พบ campaign นี้' })
      }

      if (!['draft', 'scheduled', 'paused'].includes(campaign.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `ไม่สามารถส่ง campaign ที่มีสถานะ "${campaign.status}" ได้`,
        })
      }

      if (!campaign.template_id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'กรุณาเลือก template ก่อนส่ง campaign',
        })
      }

      // อัพเดทสถานะ → sending
      await supabase
        .from('campaigns')
        .update({ status: 'sending', updated_at: new Date().toISOString() })
        .eq('id', input.campaignId)

      // Trigger send แบบ fire and forget
      triggerCampaignSend(input.campaignId)

      return { triggered: true, campaignId: input.campaignId }
    }),

  // ----------------------------------------------------------
  // pause — หยุดชั่วคราว
  // ----------------------------------------------------------
  pause: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        campaignId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { data, error } = await supabase
        .from('campaigns')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', input.campaignId)
        .eq('workspace_id', input.workspaceId)
        .in('status', ['sending', 'scheduled'])
        .select('*')
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถหยุด campaign ได้',
          cause: error,
        })
      }

      return data
    }),

  // ----------------------------------------------------------
  // cancel — ยกเลิก
  // ----------------------------------------------------------
  cancel: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        campaignId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { data, error } = await supabase
        .from('campaigns')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', input.campaignId)
        .eq('workspace_id', input.workspaceId)
        .select('*')
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถยกเลิก campaign ได้',
          cause: error,
        })
      }

      return data
    }),

  // ----------------------------------------------------------
  // previewAudience — นับจำนวน recipients ที่ match audience filter
  // ----------------------------------------------------------
  previewAudience: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        audienceFilter: z
          .object({
            tags: z.array(z.string()).optional(),
            minScore: z.number().min(0).max(100).optional(),
            maxScore: z.number().min(0).max(100).optional(),
            status: z.enum(['new', 'contacted', 'qualified', 'unqualified']).optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      let query = supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', input.workspaceId)
        .not('email', 'is', null)
        .neq('email', '')

      if (input.audienceFilter?.status) {
        query = query.eq('status', input.audienceFilter.status)
      }

      const { count } = await query

      return { count: count ?? 0 }
    }),
})
