import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import { createClient } from '@/lib/supabase/server'

// Slug validation: lowercase letters, numbers, hyphens only
const slugSchema = z
  .string()
  .min(3, 'Slug ต้องมีอย่างน้อย 3 ตัวอักษร')
  .max(50)
  .regex(/^[a-z0-9-]+$/, 'Slug ใช้ได้เฉพาะตัวอักษรพิมพ์เล็ก ตัวเลข และ - เท่านั้น')

export const agencyRouter = router({
  // ============================================================
  // get — ดึง agency ของ current user (เป็น owner)
  // ============================================================
  get: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('agencies')
      .select('id, name, slug, owner_id, created_at, updated_at')
      .eq('owner_id', ctx.user.id)
      .maybeSingle()

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'ไม่สามารถดึงข้อมูล agency ได้',
        cause: error,
      })
    }

    return data // null = ยังไม่มี agency (onboarding)
  }),

  // ============================================================
  // create — สร้าง agency ใหม่ (onboarding flow)
  //   - สร้าง agency
  //   - สร้าง default workspace (type: 'agency')
  //   - เพิ่ม owner เป็น agency_admin ใน workspace นั้น
  // ============================================================
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, 'กรุณากรอกชื่อ agency').max(100),
        slug: slugSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()

      // 1. ตรวจสอบว่า user ยังไม่มี agency
      const { data: existing } = await supabase
        .from('agencies')
        .select('id')
        .eq('owner_id', ctx.user.id)
        .maybeSingle()

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'คุณมี agency อยู่แล้ว ไม่สามารถสร้างซ้ำได้',
        })
      }

      // 2. ตรวจสอบ slug ซ้ำ
      const { data: slugConflict } = await supabase
        .from('agencies')
        .select('id')
        .eq('slug', input.slug)
        .maybeSingle()

      if (slugConflict) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Slug นี้ถูกใช้งานแล้ว กรุณาเลือก slug อื่น',
        })
      }

      // 3. สร้าง agency
      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .insert({
          name: input.name,
          slug: input.slug,
          owner_id: ctx.user.id,
        })
        .select('id, name, slug, owner_id, created_at, updated_at')
        .single()

      if (agencyError || !agency) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถสร้าง agency ได้',
          cause: agencyError,
        })
      }

      // 4. สร้าง default workspace (type: 'agency')
      const { data: workspace, error: wsError } = await supabase
        .from('workspaces')
        .insert({
          agency_id: agency.id,
          name: input.name, // ชื่อ workspace เดียวกับ agency ใน default
          type: 'agency',
        })
        .select('id, name, type')
        .single()

      if (wsError || !workspace) {
        // rollback agency ถ้า workspace สร้างไม่ได้
        await supabase.from('agencies').delete().eq('id', agency.id)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถสร้าง default workspace ได้',
          cause: wsError,
        })
      }

      // 5. เพิ่ม owner เป็น agency_admin ใน workspace
      const { error: memberError } = await supabase.from('workspace_members').insert({
        workspace_id: workspace.id,
        user_id: ctx.user.id,
        role: 'agency_admin',
        joined_at: new Date().toISOString(),
      })

      if (memberError) {
        // rollback
        await supabase.from('workspaces').delete().eq('id', workspace.id)
        await supabase.from('agencies').delete().eq('id', agency.id)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถตั้งค่าสมาชิกได้',
          cause: memberError,
        })
      }

      // 6. Audit log
      await supabase.from('audit_logs').insert({
        actor_id: ctx.user.id,
        action: 'agency.create',
        resource_type: 'agency',
        resource_id: agency.id,
        metadata: { agency_name: agency.name, slug: agency.slug },
      })

      return {
        agency,
        defaultWorkspace: workspace,
      }
    }),

  // ============================================================
  // update — แก้ข้อมูล agency (owner เท่านั้น)
  // ============================================================
  update: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, 'กรุณากรอกชื่อ agency').max(100).optional(),
        slug: slugSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()

      // ตรวจสอบว่า user เป็น owner
      const { data: agency } = await supabase
        .from('agencies')
        .select('id, name, slug')
        .eq('owner_id', ctx.user.id)
        .maybeSingle()

      if (!agency) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'ไม่พบ agency หรือคุณไม่มีสิทธิ์แก้ไข',
        })
      }

      const updateData: Record<string, unknown> = {}
      if (input.name !== undefined) updateData.name = input.name
      if (input.slug !== undefined) {
        // ตรวจสอบ slug ซ้ำ
        const { data: slugConflict } = await supabase
          .from('agencies')
          .select('id')
          .eq('slug', input.slug)
          .neq('id', agency.id)
          .maybeSingle()

        if (slugConflict) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Slug นี้ถูกใช้งานแล้ว กรุณาเลือก slug อื่น',
          })
        }
        updateData.slug = input.slug
      }

      if (Object.keys(updateData).length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'ไม่มีข้อมูลที่ต้องการแก้ไข' })
      }

      const { data: updated, error } = await supabase
        .from('agencies')
        .update(updateData)
        .eq('id', agency.id)
        .select('id, name, slug, owner_id, created_at, updated_at')
        .single()

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถแก้ไข agency ได้',
          cause: error,
        })
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        actor_id: ctx.user.id,
        action: 'agency.update',
        resource_type: 'agency',
        resource_id: agency.id,
        metadata: updateData,
      })

      return updated
    }),
})
