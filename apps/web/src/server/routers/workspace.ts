import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import { createClient } from '@/lib/supabase/server'

const workspaceTypeSchema = z.enum(['agency', 'client'])

export const workspaceRouter = router({
  // ============================================================
  // list — ดึง workspaces ทั้งหมดที่ user เป็น member
  // ============================================================
  list: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('workspace_members')
      .select(
        `
        role,
        joined_at,
        workspace:workspaces (
          id,
          name,
          type,
          agency_id,
          created_at,
          updated_at
        )
      `,
      )
      .eq('user_id', ctx.user.id)
      .not('workspace', 'is', null)
      .order('joined_at', { ascending: false })

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'ไม่สามารถดึงรายการ workspaces ได้',
        cause: error,
      })
    }

    return (data ?? []).map((row) => ({
      ...row.workspace,
      memberRole: row.role,
      joinedAt: row.joined_at,
    }))
  }),

  // ============================================================
  // getById — ดึง workspace ตาม id (ต้อง verify access)
  // ============================================================
  getById: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid('workspace ID ไม่ถูกต้อง') }))
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()

      // ตรวจสอบสิทธิ์ผ่าน workspace_members ก่อน
      const { data: membership, error: memberError } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', input.workspaceId)
        .eq('user_id', ctx.user.id)
        .maybeSingle()

      if (memberError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถตรวจสอบสิทธิ์ได้',
          cause: memberError,
        })
      }

      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'คุณไม่มีสิทธิ์เข้าถึง workspace นี้',
        })
      }

      const { data: workspace, error } = await supabase
        .from('workspaces')
        .select(
          `
          id, name, type, agency_id, created_at, updated_at,
          agency:agencies ( id, name, slug )
        `,
        )
        .eq('id', input.workspaceId)
        .single()

      if (error || !workspace) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'ไม่พบ workspace',
        })
      }

      return {
        ...workspace,
        memberRole: membership.role as 'agency_admin' | 'agency_member' | 'client_viewer',
      }
    }),

  // ============================================================
  // create — สร้าง workspace ใหม่ (ต้องเป็น agency owner)
  // ============================================================
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, 'กรุณากรอกชื่อ workspace').max(100),
        type: workspaceTypeSchema,
        agencyId: z.string().uuid('agency ID ไม่ถูกต้อง'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()

      // ตรวจสอบว่า user เป็น owner ของ agency นี้
      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('id', input.agencyId)
        .eq('owner_id', ctx.user.id)
        .maybeSingle()

      if (agencyError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถตรวจสอบสิทธิ์ได้',
          cause: agencyError,
        })
      }

      if (!agency) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'เฉพาะ agency owner เท่านั้นที่สามารถสร้าง workspace ได้',
        })
      }

      // สร้าง workspace
      const { data: workspace, error: wsError } = await supabase
        .from('workspaces')
        .insert({
          agency_id: input.agencyId,
          name: input.name,
          type: input.type,
        })
        .select('id, name, type, agency_id, created_at, updated_at')
        .single()

      if (wsError || !workspace) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถสร้าง workspace ได้',
          cause: wsError,
        })
      }

      // เพิ่ม owner เป็น agency_admin ใน workspace นี้ด้วย
      const { error: memberError } = await supabase.from('workspace_members').insert({
        workspace_id: workspace.id,
        user_id: ctx.user.id,
        role: 'agency_admin',
        joined_at: new Date().toISOString(),
      })

      if (memberError) {
        // rollback workspace
        await supabase.from('workspaces').delete().eq('id', workspace.id)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถตั้งค่าสมาชิกของ workspace ได้',
          cause: memberError,
        })
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        actor_id: ctx.user.id,
        action: 'workspace.create',
        resource_type: 'workspace',
        resource_id: workspace.id,
        metadata: { workspace_name: workspace.name, type: workspace.type },
      })

      return workspace
    }),

  // ============================================================
  // update — แก้ชื่อ workspace (ต้องเป็น admin)
  // ============================================================
  update: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid('workspace ID ไม่ถูกต้อง'),
        name: z.string().min(1, 'กรุณากรอกชื่อ workspace').max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()

      // ต้องเป็น agency_admin ของ workspace นี้
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', input.workspaceId)
        .eq('user_id', ctx.user.id)
        .eq('role', 'agency_admin')
        .maybeSingle()

      if (!membership) {
        // หรืออาจเป็น agency owner แทน
        const { data: isOwner } = await supabase
          .from('workspaces')
          .select('agency_id')
          .eq('id', input.workspaceId)
          .single()

        if (isOwner) {
          const { data: ownerCheck } = await supabase
            .from('agencies')
            .select('id')
            .eq('id', isOwner.agency_id)
            .eq('owner_id', ctx.user.id)
            .maybeSingle()

          if (!ownerCheck) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'เฉพาะ admin เท่านั้นที่สามารถแก้ไข workspace ได้',
            })
          }
        } else {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'ไม่พบ workspace',
          })
        }
      }

      const { data: updated, error } = await supabase
        .from('workspaces')
        .update({ name: input.name })
        .eq('id', input.workspaceId)
        .select('id, name, type, agency_id, created_at, updated_at')
        .single()

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถแก้ไข workspace ได้',
          cause: error,
        })
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        actor_id: ctx.user.id,
        action: 'workspace.update',
        resource_type: 'workspace',
        resource_id: input.workspaceId,
        metadata: { name: input.name },
      })

      return updated
    }),

  // ============================================================
  // delete — ลบ workspace (ต้องเป็น agency owner เท่านั้น)
  // ============================================================
  delete: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid('workspace ID ไม่ถูกต้อง'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()

      // ดึง workspace + ตรวจสอบว่า user เป็น owner ของ agency
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id, name, type, agency_id')
        .eq('id', input.workspaceId)
        .single()

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ไม่พบ workspace' })
      }

      // ต้องเป็น agency owner เท่านั้น
      const { data: agency } = await supabase
        .from('agencies')
        .select('id')
        .eq('id', workspace.agency_id)
        .eq('owner_id', ctx.user.id)
        .maybeSingle()

      if (!agency) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'เฉพาะ agency owner เท่านั้นที่สามารถลบ workspace ได้',
        })
      }

      // ห้ามลบ workspace ประเภท 'agency' (default workspace)
      if (workspace.type === 'agency') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'ไม่สามารถลบ default agency workspace ได้',
        })
      }

      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', input.workspaceId)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถลบ workspace ได้',
          cause: error,
        })
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        actor_id: ctx.user.id,
        action: 'workspace.delete',
        resource_type: 'workspace',
        resource_id: input.workspaceId,
        metadata: { workspace_name: workspace.name },
      })

      return { success: true, deletedId: input.workspaceId }
    }),
})
