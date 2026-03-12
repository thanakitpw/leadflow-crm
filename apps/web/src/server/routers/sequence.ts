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

export const sequenceRouter = router({
  // ----------------------------------------------------------
  // list — ดึง sequences ของ workspace
  // ----------------------------------------------------------
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const from = (input.page - 1) * input.pageSize
      const to = from + input.pageSize - 1

      const { data, error, count } = await supabase
        .from('sequences')
        .select('id, name, status, created_at, updated_at', { count: 'exact' })
        .eq('workspace_id', input.workspaceId)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถดึงรายการ sequences ได้',
          cause: error,
        })
      }

      // ดึง steps count และ enrollments count
      const sequenceIds = (data ?? []).map((s) => s.id)
      const stepsCountMap: Record<string, number> = {}
      const enrollmentsCountMap: Record<string, number> = {}

      if (sequenceIds.length > 0) {
        const { data: stepsData } = await supabase
          .from('sequence_steps')
          .select('sequence_id')
          .in('sequence_id', sequenceIds)

        for (const row of stepsData ?? []) {
          stepsCountMap[row.sequence_id] = (stepsCountMap[row.sequence_id] ?? 0) + 1
        }

        const { data: enrollData } = await supabase
          .from('sequence_enrollments')
          .select('sequence_id')
          .in('sequence_id', sequenceIds)
          .eq('status', 'active')

        for (const row of enrollData ?? []) {
          enrollmentsCountMap[row.sequence_id] = (enrollmentsCountMap[row.sequence_id] ?? 0) + 1
        }
      }

      const sequences = (data ?? []).map((s) => ({
        ...s,
        stepsCount: stepsCountMap[s.id] ?? 0,
        activeEnrollments: enrollmentsCountMap[s.id] ?? 0,
      }))

      return {
        sequences,
        total: count ?? 0,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil((count ?? 0) / input.pageSize),
      }
    }),

  // ----------------------------------------------------------
  // getById — sequence detail พร้อม steps + enrollments count
  // ----------------------------------------------------------
  getById: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        sequenceId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { data, error } = await supabase
        .from('sequences')
        .select('*')
        .eq('id', input.sequenceId)
        .eq('workspace_id', input.workspaceId)
        .single()

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ไม่พบ sequence นี้' })
      }

      // ดึง steps
      const { data: steps } = await supabase
        .from('sequence_steps')
        .select(
          `
          id, step_order, delay_days, condition, created_at,
          template_id,
          email_templates ( id, name, subject )
        `,
        )
        .eq('sequence_id', input.sequenceId)
        .order('step_order', { ascending: true })

      // ดึง enrollments count
      const { count: activeEnrollments } = await supabase
        .from('sequence_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('sequence_id', input.sequenceId)
        .eq('status', 'active')

      return {
        ...data,
        steps: steps ?? [],
        activeEnrollments: activeEnrollments ?? 0,
      }
    }),

  // ----------------------------------------------------------
  // create — สร้าง sequence
  // ----------------------------------------------------------
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        name: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { data, error } = await supabase
        .from('sequences')
        .insert({
          workspace_id: input.workspaceId,
          name: input.name,
          status: 'draft',
        })
        .select('*')
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถสร้าง sequence ได้',
          cause: error,
        })
      }

      return data
    }),

  // ----------------------------------------------------------
  // update — แก้ไข (name, status)
  // ----------------------------------------------------------
  update: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        sequenceId: z.string().uuid(),
        name: z.string().min(1).optional(),
        status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (input.name !== undefined) updateData.name = input.name
      if (input.status !== undefined) updateData.status = input.status

      const { data, error } = await supabase
        .from('sequences')
        .update(updateData)
        .eq('id', input.sequenceId)
        .eq('workspace_id', input.workspaceId)
        .select('*')
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถแก้ไข sequence ได้',
          cause: error,
        })
      }

      return data
    }),

  // ----------------------------------------------------------
  // delete — ลบ
  // ----------------------------------------------------------
  delete: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        sequenceId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { error } = await supabase
        .from('sequences')
        .delete()
        .eq('id', input.sequenceId)
        .eq('workspace_id', input.workspaceId)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถลบ sequence ได้',
          cause: error,
        })
      }

      return { success: true, deletedId: input.sequenceId }
    }),

  // ----------------------------------------------------------
  // addStep — เพิ่ม step (template_id, delay_days, condition)
  // ----------------------------------------------------------
  addStep: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        sequenceId: z.string().uuid(),
        templateId: z.string().uuid(),
        delayDays: z.number().int().min(0).default(0),
        condition: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      // ตรวจสอบว่า sequence อยู่ใน workspace นี้
      const { data: seq } = await supabase
        .from('sequences')
        .select('id')
        .eq('id', input.sequenceId)
        .eq('workspace_id', input.workspaceId)
        .maybeSingle()

      if (!seq) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ไม่พบ sequence นี้' })
      }

      // หา step_order ถัดไป
      const { count } = await supabase
        .from('sequence_steps')
        .select('id', { count: 'exact', head: true })
        .eq('sequence_id', input.sequenceId)

      const nextOrder = (count ?? 0) + 1

      const { data, error } = await supabase
        .from('sequence_steps')
        .insert({
          sequence_id: input.sequenceId,
          template_id: input.templateId,
          delay_days: input.delayDays,
          condition: input.condition ?? null,
          step_order: nextOrder,
        })
        .select('*, email_templates ( id, name, subject )')
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถเพิ่ม step ได้',
          cause: error,
        })
      }

      return data
    }),

  // ----------------------------------------------------------
  // updateStep — แก้ไข step
  // ----------------------------------------------------------
  updateStep: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        sequenceId: z.string().uuid(),
        stepId: z.string().uuid(),
        templateId: z.string().uuid().optional(),
        delayDays: z.number().int().min(0).optional(),
        condition: z.string().nullable().optional(),
        stepOrder: z.number().int().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const updateData: Record<string, unknown> = {}
      if (input.templateId !== undefined) updateData.template_id = input.templateId
      if (input.delayDays !== undefined) updateData.delay_days = input.delayDays
      if (input.condition !== undefined) updateData.condition = input.condition
      if (input.stepOrder !== undefined) updateData.step_order = input.stepOrder

      const { data, error } = await supabase
        .from('sequence_steps')
        .update(updateData)
        .eq('id', input.stepId)
        .eq('sequence_id', input.sequenceId)
        .select('*, email_templates ( id, name, subject )')
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถแก้ไข step ได้',
          cause: error,
        })
      }

      return data
    }),

  // ----------------------------------------------------------
  // removeStep — ลบ step
  // ----------------------------------------------------------
  removeStep: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        sequenceId: z.string().uuid(),
        stepId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { error } = await supabase
        .from('sequence_steps')
        .delete()
        .eq('id', input.stepId)
        .eq('sequence_id', input.sequenceId)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถลบ step ได้',
          cause: error,
        })
      }

      return { success: true, deletedId: input.stepId }
    }),

  // ----------------------------------------------------------
  // enrollLeads — enroll leads เข้า sequence
  // ----------------------------------------------------------
  enrollLeads: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        sequenceId: z.string().uuid(),
        leadIds: z.array(z.string().uuid()).min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      // ตรวจสอบว่า sequence อยู่ใน workspace นี้
      const { data: seq } = await supabase
        .from('sequences')
        .select('id, status')
        .eq('id', input.sequenceId)
        .eq('workspace_id', input.workspaceId)
        .maybeSingle()

      if (!seq) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ไม่พบ sequence นี้' })
      }

      // ดึง leads ที่ยังไม่ enrolled
      const { data: existing } = await supabase
        .from('sequence_enrollments')
        .select('lead_id')
        .eq('sequence_id', input.sequenceId)
        .in('lead_id', input.leadIds)

      const existingIds = new Set((existing ?? []).map((r) => r.lead_id))
      const toEnroll = input.leadIds.filter((id) => !existingIds.has(id))

      if (toEnroll.length === 0) {
        return { enrolled: 0, skipped: input.leadIds.length }
      }

      const { data, error } = await supabase
        .from('sequence_enrollments')
        .insert(
          toEnroll.map((leadId) => ({
            sequence_id: input.sequenceId,
            lead_id: leadId,
            status: 'active',
            current_step: 1,
          })),
        )
        .select('id')

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถ enroll leads ได้',
          cause: error,
        })
      }

      return {
        enrolled: data?.length ?? 0,
        skipped: input.leadIds.length - (data?.length ?? 0),
      }
    }),

  // ----------------------------------------------------------
  // getEnrollments — ดึง leads ที่ enrolled ใน sequence
  // ----------------------------------------------------------
  getEnrollments: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        sequenceId: z.string().uuid(),
        status: z.enum(['active', 'completed', 'paused', 'failed']).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      let query = supabase
        .from('sequence_enrollments')
        .select(
          `
          id, status, current_step, enrolled_at, completed_at,
          leads ( id, name, email )
        `,
          { count: 'exact' },
        )
        .eq('sequence_id', input.sequenceId)
        .order('enrolled_at', { ascending: false })

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
          message: 'ไม่สามารถดึงรายการ enrollments ได้',
          cause: error,
        })
      }

      return {
        enrollments: data ?? [],
        total: count ?? 0,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil((count ?? 0) / input.pageSize),
      }
    }),
})
