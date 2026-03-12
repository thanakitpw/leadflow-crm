import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import { createClient } from '@/lib/supabase/server'

// ============================================================
// Schemas
// ============================================================

const leadStatusSchema = z.enum(['new', 'contacted', 'qualified', 'unqualified'])

const leadCreateSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  placeId: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().min(0).optional(),
  category: z.string().optional(),
  sourceType: z.enum(['places_api', 'manual', 'import']).default('places_api'),
})

// ============================================================
// Helpers
// ============================================================

/** ตรวจสอบว่า user เป็น member ของ workspace นี้ */
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

export const leadRouter = router({
  // ----------------------------------------------------------
  // list — ดึง leads ของ workspace พร้อม filter, sort, pagination
  // ----------------------------------------------------------
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        status: leadStatusSchema.optional(),
        hasEmail: z.boolean().optional(),
        minScore: z.number().min(0).max(100).optional(),
        maxScore: z.number().min(0).max(100).optional(),
        sortBy: z.enum(['score_desc', 'score_asc', 'created_desc', 'name_asc']).default('created_desc'),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      let query = supabase
        .from('leads')
        .select(
          `
          id, name, email, phone, website, address, status,
          rating, review_count, category, source_type, place_id,
          created_at, updated_at,
          lead_scores ( score, reasoning, scored_at )
        `,
          { count: 'exact' },
        )
        .eq('workspace_id', input.workspaceId)

      // Filters
      if (input.status) {
        query = query.eq('status', input.status)
      }
      if (input.hasEmail === true) {
        query = query.not('email', 'is', null).neq('email', '')
      }
      if (input.hasEmail === false) {
        query = query.or('email.is.null,email.eq.')
      }

      // Sort
      switch (input.sortBy) {
        case 'score_desc':
          query = query.order('created_at', { ascending: false })
          break
        case 'score_asc':
          query = query.order('created_at', { ascending: true })
          break
        case 'name_asc':
          query = query.order('name', { ascending: true })
          break
        case 'created_desc':
        default:
          query = query.order('created_at', { ascending: false })
          break
      }

      // Pagination
      const from = (input.page - 1) * input.pageSize
      const to = from + input.pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถดึงรายการ leads ได้',
          cause: error,
        })
      }

      // Client-side filter by score (since lead_scores is a joined table)
      let leads = (data ?? []).map((lead) => {
        const latestScore =
          Array.isArray(lead.lead_scores) && lead.lead_scores.length > 0
            ? lead.lead_scores.sort(
                (a: { scored_at: string }, b: { scored_at: string }) =>
                  new Date(b.scored_at).getTime() - new Date(a.scored_at).getTime(),
              )[0]
            : null
        return { ...lead, score: latestScore }
      })

      if (input.minScore !== undefined) {
        leads = leads.filter((l) => l.score && l.score.score >= (input.minScore ?? 0))
      }
      if (input.maxScore !== undefined) {
        leads = leads.filter((l) => l.score && l.score.score <= (input.maxScore ?? 100))
      }
      if (input.sortBy === 'score_desc') {
        leads = leads.sort((a, b) => (b.score?.score ?? -1) - (a.score?.score ?? -1))
      }
      if (input.sortBy === 'score_asc') {
        leads = leads.sort((a, b) => (a.score?.score ?? 101) - (b.score?.score ?? 101))
      }

      return {
        leads,
        total: count ?? 0,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil((count ?? 0) / input.pageSize),
      }
    }),

  // ----------------------------------------------------------
  // getById — ดึง lead เดียวพร้อม scores และ tags
  // ----------------------------------------------------------
  getById: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        leadId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { data, error } = await supabase
        .from('leads')
        .select(
          `
          *,
          lead_scores ( id, score, reasoning, scored_at ),
          lead_tags ( id, tag )
        `,
        )
        .eq('id', input.leadId)
        .eq('workspace_id', input.workspaceId)
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'ไม่พบ lead นี้',
        })
      }

      return data
    }),

  // ----------------------------------------------------------
  // create — สร้าง lead ใหม่ (จาก Places API หรือ manual)
  // ----------------------------------------------------------
  create: protectedProcedure
    .input(leadCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      // ตรวจสอบ duplicate ด้วย place_id (ถ้ามี)
      if (input.placeId) {
        const { data: existing } = await supabase
          .from('leads')
          .select('id, name')
          .eq('workspace_id', input.workspaceId)
          .eq('place_id', input.placeId)
          .maybeSingle()

        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Lead "${existing.name}" มีอยู่แล้วใน workspace นี้`,
          })
        }
      }

      const { data, error } = await supabase
        .from('leads')
        .insert({
          workspace_id: input.workspaceId,
          name: input.name,
          address: input.address ?? null,
          phone: input.phone ?? null,
          website: input.website ?? null,
          email: input.email || null,
          place_id: input.placeId ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          rating: input.rating ?? null,
          review_count: input.reviewCount ?? null,
          category: input.category ?? null,
          source_type: input.sourceType,
          status: 'new',
        })
        .select('*')
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถบันทึก lead ได้',
          cause: error,
        })
      }

      return data
    }),

  // ----------------------------------------------------------
  // createBulk — สร้างหลาย leads พร้อมกัน (bulk save จาก search)
  // ----------------------------------------------------------
  createBulk: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        leads: z.array(leadCreateSchema.omit({ workspaceId: true })).max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      // ดึง place_ids ที่มีอยู่แล้วเพื่อ skip duplicates
      const placeIds = input.leads.map((l) => l.placeId).filter(Boolean) as string[]
      let existingPlaceIds = new Set<string>()

      if (placeIds.length > 0) {
        const { data: existing } = await supabase
          .from('leads')
          .select('place_id')
          .eq('workspace_id', input.workspaceId)
          .in('place_id', placeIds)

        existingPlaceIds = new Set((existing ?? []).map((r) => r.place_id).filter(Boolean) as string[])
      }

      const toInsert = input.leads
        .filter((l) => !l.placeId || !existingPlaceIds.has(l.placeId))
        .map((l) => ({
          workspace_id: input.workspaceId,
          name: l.name,
          address: l.address ?? null,
          phone: l.phone ?? null,
          website: l.website ?? null,
          email: l.email || null,
          place_id: l.placeId ?? null,
          latitude: l.latitude ?? null,
          longitude: l.longitude ?? null,
          rating: l.rating ?? null,
          review_count: l.reviewCount ?? null,
          category: l.category ?? null,
          source_type: l.sourceType,
          status: 'new',
        }))

      if (toInsert.length === 0) {
        return { created: 0, skipped: input.leads.length }
      }

      const { data, error } = await supabase
        .from('leads')
        .insert(toInsert)
        .select('id')

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถบันทึก leads ได้',
          cause: error,
        })
      }

      return {
        created: data?.length ?? 0,
        skipped: input.leads.length - (data?.length ?? 0),
      }
    }),

  // ----------------------------------------------------------
  // update — แก้ไข lead (status, email, notes, etc.)
  // ----------------------------------------------------------
  update: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        leadId: z.string().uuid(),
        status: leadStatusSchema.optional(),
        email: z.string().email().optional().or(z.literal('')),
        phone: z.string().optional(),
        website: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (input.status !== undefined) updateData.status = input.status
      if (input.email !== undefined) updateData.email = input.email || null
      if (input.phone !== undefined) updateData.phone = input.phone
      if (input.website !== undefined) updateData.website = input.website
      if (input.notes !== undefined) updateData.notes = input.notes

      const { data, error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', input.leadId)
        .eq('workspace_id', input.workspaceId)
        .select('*')
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถแก้ไข lead ได้',
          cause: error,
        })
      }

      return data
    }),

  // ----------------------------------------------------------
  // delete — ลบ lead เดียว
  // ----------------------------------------------------------
  delete: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        leadId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      const membership = await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      if (!['agency_admin', 'agency_member'].includes(membership.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'คุณไม่มีสิทธิ์ลบ lead',
        })
      }

      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', input.leadId)
        .eq('workspace_id', input.workspaceId)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถลบ lead ได้',
          cause: error,
        })
      }

      return { success: true, deletedId: input.leadId }
    }),

  // ----------------------------------------------------------
  // deleteBulk — ลบหลาย leads พร้อมกัน
  // ----------------------------------------------------------
  deleteBulk: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        leadIds: z.array(z.string().uuid()).min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      const membership = await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      if (!['agency_admin', 'agency_member'].includes(membership.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'คุณไม่มีสิทธิ์ลบ lead',
        })
      }

      const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', input.leadIds)
        .eq('workspace_id', input.workspaceId)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถลบ leads ได้',
          cause: error,
        })
      }

      return { success: true, deletedCount: input.leadIds.length }
    }),

  // ----------------------------------------------------------
  // addTag — เพิ่ม tag ให้ lead
  // ----------------------------------------------------------
  addTag: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        leadId: z.string().uuid(),
        tag: z.string().min(1).max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      // ตรวจสอบว่า lead อยู่ใน workspace นี้
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('id', input.leadId)
        .eq('workspace_id', input.workspaceId)
        .maybeSingle()

      if (!lead) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ไม่พบ lead นี้' })
      }

      const { data, error } = await supabase
        .from('lead_tags')
        .insert({ lead_id: input.leadId, tag: input.tag })
        .select('*')
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Tag "${input.tag}" มีอยู่แล้ว`,
          })
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถเพิ่ม tag ได้',
          cause: error,
        })
      }

      return data
    }),

  // ----------------------------------------------------------
  // removeTag — ลบ tag ออกจาก lead
  // ----------------------------------------------------------
  removeTag: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        tagId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { error } = await supabase
        .from('lead_tags')
        .delete()
        .eq('id', input.tagId)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถลบ tag ได้',
          cause: error,
        })
      }

      return { success: true }
    }),

  // ----------------------------------------------------------
  // exportCsv — ส่ง CSV data ของ leads ใน workspace
  // ----------------------------------------------------------
  exportCsv: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        status: leadStatusSchema.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      let query = supabase
        .from('leads')
        .select(
          `
          id, name, email, phone, website, address, status,
          rating, review_count, category, created_at,
          lead_scores ( score, reasoning, scored_at )
        `,
        )
        .eq('workspace_id', input.workspaceId)
        .order('created_at', { ascending: false })

      if (input.status) {
        query = query.eq('status', input.status)
      }

      const { data, error } = await query

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถดึงข้อมูลสำหรับ export ได้',
          cause: error,
        })
      }

      // แปลงเป็น CSV rows
      const headers = ['ชื่อธุรกิจ', 'อีเมล', 'เบอร์โทร', 'เว็บไซต์', 'ที่อยู่', 'สถานะ', 'คะแนน', 'Rating', 'Reviews', 'หมวดหมู่', 'วันที่เพิ่ม']
      const rows = (data ?? []).map((lead) => {
        const latestScore = Array.isArray(lead.lead_scores) && lead.lead_scores.length > 0
          ? lead.lead_scores.sort(
              (a: { scored_at: string }, b: { scored_at: string }) =>
                new Date(b.scored_at).getTime() - new Date(a.scored_at).getTime(),
            )[0]
          : null
        return [
          lead.name ?? '',
          lead.email ?? '',
          lead.phone ?? '',
          lead.website ?? '',
          lead.address ?? '',
          lead.status ?? '',
          latestScore?.score?.toString() ?? '',
          lead.rating?.toString() ?? '',
          lead.review_count?.toString() ?? '',
          lead.category ?? '',
          lead.created_at ? new Date(lead.created_at).toLocaleDateString('th-TH') : '',
        ]
      })

      return { headers, rows }
    }),
})
