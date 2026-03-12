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

export const templateRouter = router({
  // ----------------------------------------------------------
  // list — ดึง templates ของ workspace (category filter)
  // ----------------------------------------------------------
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        category: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      let query = supabase
        .from('email_templates')
        .select('id, name, subject, category, created_at, updated_at', { count: 'exact' })
        .eq('workspace_id', input.workspaceId)
        .order('created_at', { ascending: false })

      if (input.category) {
        query = query.eq('category', input.category)
      }

      const from = (input.page - 1) * input.pageSize
      const to = from + input.pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถดึงรายการ templates ได้',
          cause: error,
        })
      }

      return {
        templates: data ?? [],
        total: count ?? 0,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil((count ?? 0) / input.pageSize),
      }
    }),

  // ----------------------------------------------------------
  // getById — template detail
  // ----------------------------------------------------------
  getById: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        templateId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', input.templateId)
        .eq('workspace_id', input.workspaceId)
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'ไม่พบ template นี้',
        })
      }

      return data
    }),

  // ----------------------------------------------------------
  // create — สร้าง template
  // ----------------------------------------------------------
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        name: z.string().min(1),
        subject: z.string().min(1),
        bodyHtml: z.string().min(1),
        category: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { data, error } = await supabase
        .from('email_templates')
        .insert({
          workspace_id: input.workspaceId,
          name: input.name,
          subject: input.subject,
          body_html: input.bodyHtml,
          category: input.category ?? null,
        })
        .select('*')
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถสร้าง template ได้',
          cause: error,
        })
      }

      return data
    }),

  // ----------------------------------------------------------
  // update — แก้ไข template
  // ----------------------------------------------------------
  update: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        templateId: z.string().uuid(),
        name: z.string().min(1).optional(),
        subject: z.string().min(1).optional(),
        bodyHtml: z.string().optional(),
        category: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (input.name !== undefined) updateData.name = input.name
      if (input.subject !== undefined) updateData.subject = input.subject
      if (input.bodyHtml !== undefined) updateData.body_html = input.bodyHtml
      if (input.category !== undefined) updateData.category = input.category

      const { data, error } = await supabase
        .from('email_templates')
        .update(updateData)
        .eq('id', input.templateId)
        .eq('workspace_id', input.workspaceId)
        .select('*')
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถแก้ไข template ได้',
          cause: error,
        })
      }

      return data
    }),

  // ----------------------------------------------------------
  // delete — ลบ template
  // ----------------------------------------------------------
  delete: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        templateId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', input.templateId)
        .eq('workspace_id', input.workspaceId)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถลบ template ได้',
          cause: error,
        })
      }

      return { success: true, deletedId: input.templateId }
    }),

  // ----------------------------------------------------------
  // duplicate — สำเนา template
  // ----------------------------------------------------------
  duplicate: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        templateId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      // ดึง template ต้นฉบับ
      const { data: original, error: fetchError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', input.templateId)
        .eq('workspace_id', input.workspaceId)
        .single()

      if (fetchError || !original) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ไม่พบ template นี้' })
      }

      const { data, error } = await supabase
        .from('email_templates')
        .insert({
          workspace_id: input.workspaceId,
          name: `${original.name} (สำเนา)`,
          subject: original.subject,
          body_html: original.body_html,
          category: original.category,
        })
        .select('*')
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถสำเนา template ได้',
          cause: error,
        })
      }

      return data
    }),
})
