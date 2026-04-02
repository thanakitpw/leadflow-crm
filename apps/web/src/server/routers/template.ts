import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import { createClient } from '@/lib/supabase/server'
import { replaceVariables } from '@/lib/email/template-variables'

const PYTHON_API_URL = process.env.PYTHON_API_URL ?? 'http://localhost:8000'
const DEFAULT_FROM_EMAIL = process.env.DEFAULT_FROM_EMAIL ?? process.env.EMAIL_FROM ?? 'noreply@leadflow.app'

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

  // ----------------------------------------------------------
  // testSend — ส่ง email ทดสอบด้วย sample data
  // ----------------------------------------------------------
  testSend: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        templateId: z.string().uuid(),
        toEmail: z.string().email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      // ดึง template จาก DB
      const { data: template, error: fetchError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', input.templateId)
        .eq('workspace_id', input.workspaceId)
        .single()

      if (fetchError || !template) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ไม่พบ template นี้' })
      }

      // Sample data สำหรับทดสอบ (ทั้ง key ภาษาอังกฤษ และภาษาไทย)
      const sampleData: Record<string, string> = {
        business_name: 'ร้านตัวอย่าง',
        first_name: 'สมชาย',
        location: 'กรุงเทพมหานคร',
        category: 'ร้านอาหาร',
        email: 'test@example.com',
        phone: '02-123-4567',
        website: 'https://example.com',
        // ภาษาไทย
        'ชื่อ': 'สมชาย',
        'ชื่อร้าน': 'ร้านตัวอย่าง',
        'หมวดหมู่': 'ร้านอาหาร',
        'ที่อยู่': 'กรุงเทพมหานคร',
        'อีเมล': 'test@example.com',
        'เบอร์โทร': '02-123-4567',
        'เว็บไซต์': 'https://example.com',
        'คะแนน': '4.5',
      }

      // แทนที่ตัวแปรใน subject และ body
      const subject = `[ทดสอบ] ${replaceVariables(template.subject, sampleData)}`
      const htmlBody = replaceVariables(template.body_html, sampleData)

      // เรียก Python API เพื่อส่ง email
      const emailPayload = {
        from_email: DEFAULT_FROM_EMAIL,
        to_email: input.toEmail,
        subject,
        html_body: htmlBody,
      }
      console.log('[testSend] Sending to Python API:', PYTHON_API_URL, 'from:', DEFAULT_FROM_EMAIL, 'to:', input.toEmail)
      let response: Response
      try {
        response = await fetch(`${PYTHON_API_URL}/api/v1/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailPayload),
        })
        console.log('[testSend] Python API response status:', response.status)
      } catch (err) {
        console.error('[testSend] Failed to connect:', err)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถเชื่อมต่อกับ email service ได้',
          cause: err,
        })
      }

      if (!response.ok) {
        let detail = ''
        try {
          const body = await response.json() as { detail?: string }
          detail = body.detail ?? ''
        } catch {
          // ignore parse error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: detail
            ? `ส่ง email ทดสอบไม่สำเร็จ: ${detail}`
            : 'ส่ง email ทดสอบไม่สำเร็จ',
        })
      }

      const result = await response.json() as { message_id?: string }

      return {
        success: true,
        messageId: result.message_id ?? '',
      }
    }),
})
