import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import { createClient } from '@/lib/supabase/server'

const roleSchema = z.enum(['agency_admin', 'agency_member', 'client_viewer'])

// ============================================================
// Helper: ตรวจสอบว่า user เป็น admin ของ workspace
// ============================================================
async function assertWorkspaceAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  userId: string,
) {
  const { data } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('role', 'agency_admin')
    .maybeSingle()

  if (!data) {
    // fallback: อาจเป็น agency owner ก็ได้
    const { data: ws } = await supabase
      .from('workspaces')
      .select('agency_id')
      .eq('id', workspaceId)
      .maybeSingle()

    if (ws) {
      const { data: ownerCheck } = await supabase
        .from('agencies')
        .select('id')
        .eq('id', ws.agency_id)
        .eq('owner_id', userId)
        .maybeSingle()

      if (ownerCheck) return // agency owner ผ่าน
    }

    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'เฉพาะ admin เท่านั้นที่สามารถทำรายการนี้ได้',
    })
  }
}

export const memberRouter = router({
  // ============================================================
  // list — ดึง members ของ workspace
  // ============================================================
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid('workspace ID ไม่ถูกต้อง') }))
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()

      // ตรวจสอบว่า caller เป็น member ของ workspace นี้ก่อน
      const { data: selfMembership } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', input.workspaceId)
        .eq('user_id', ctx.user.id)
        .maybeSingle()

      if (!selfMembership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'คุณไม่มีสิทธิ์เข้าถึง workspace นี้',
        })
      }

      const { data, error } = await supabase
        .from('workspace_members')
        .select(
          `
          id,
          role,
          invited_email,
          invited_at,
          joined_at,
          created_at,
          profile:profiles ( id, email, full_name, avatar_url )
        `,
        )
        .eq('workspace_id', input.workspaceId)
        .order('created_at', { ascending: true })

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถดึงรายการสมาชิกได้',
          cause: error,
        })
      }

      return data ?? []
    }),

  // ============================================================
  // invite — invite member ด้วย email
  //   - ถ้า user มี profile แล้ว → เพิ่มเป็น member ทันที
  //   - ถ้ายังไม่มี → สร้าง pending row ด้วย invited_email
  // ============================================================
  invite: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid('workspace ID ไม่ถูกต้อง'),
        email: z.string().email('รูปแบบ email ไม่ถูกต้อง').toLowerCase(),
        role: roleSchema.default('agency_member'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()

      await assertWorkspaceAdmin(supabase, input.workspaceId, ctx.user.id)

      // ตรวจสอบว่า email นี้ยังไม่เป็น member อยู่แล้ว
      const { data: existingMember } = await supabase
        .from('workspace_members')
        .select('id, invited_email, user_id')
        .eq('workspace_id', input.workspaceId)
        .or(`invited_email.eq.${input.email}`)
        .maybeSingle()

      if (existingMember) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'email นี้เป็นสมาชิกหรือได้รับการเชิญไปแล้ว',
        })
      }

      // ค้นหา profile จาก email
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', input.email)
        .maybeSingle()

      // ถ้า profile มีอยู่แล้ว ตรวจสอบว่าเป็น member อยู่แล้วผ่าน user_id
      if (profile) {
        const { data: memberByUserId } = await supabase
          .from('workspace_members')
          .select('id')
          .eq('workspace_id', input.workspaceId)
          .eq('user_id', profile.id)
          .maybeSingle()

        if (memberByUserId) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'ผู้ใช้คนนี้เป็นสมาชิกของ workspace นี้อยู่แล้ว',
          })
        }
      }

      const insertData: Record<string, unknown> = {
        workspace_id: input.workspaceId,
        role: input.role,
        invited_email: input.email,
        invited_at: new Date().toISOString(),
      }

      // ถ้า user มี account แล้ว เพิ่ม user_id และ joined_at ทันที
      if (profile) {
        insertData.user_id = profile.id
        insertData.joined_at = new Date().toISOString()
      }

      const { data: member, error } = await supabase
        .from('workspace_members')
        .insert(insertData)
        .select('id, role, invited_email, invited_at, joined_at, user_id')
        .single()

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถเชิญสมาชิกได้',
          cause: error,
        })
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        actor_id: ctx.user.id,
        action: 'member.invite',
        resource_type: 'workspace_member',
        resource_id: member.id,
        metadata: { workspace_id: input.workspaceId, email: input.email, role: input.role },
      })

      // TODO: Phase 1 - ส่ง invitation email ผ่าน Resend

      return {
        member,
        isExistingUser: !!profile,
      }
    }),

  // ============================================================
  // updateRole — เปลี่ยน role ของ member
  // ============================================================
  updateRole: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid('workspace ID ไม่ถูกต้อง'),
        memberId: z.string().uuid('member ID ไม่ถูกต้อง'),
        role: roleSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()

      await assertWorkspaceAdmin(supabase, input.workspaceId, ctx.user.id)

      // ดึง member ที่ต้องการแก้ไข
      const { data: targetMember } = await supabase
        .from('workspace_members')
        .select('id, user_id, role')
        .eq('id', input.memberId)
        .eq('workspace_id', input.workspaceId)
        .maybeSingle()

      if (!targetMember) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ไม่พบสมาชิกนี้ใน workspace' })
      }

      // ห้ามแก้ไข role ของตัวเอง
      if (targetMember.user_id === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'ไม่สามารถแก้ไข role ของตัวเองได้',
        })
      }

      const { data: updated, error } = await supabase
        .from('workspace_members')
        .update({ role: input.role })
        .eq('id', input.memberId)
        .select('id, role, user_id, invited_email')
        .single()

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถแก้ไข role ได้',
          cause: error,
        })
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        actor_id: ctx.user.id,
        action: 'member.updateRole',
        resource_type: 'workspace_member',
        resource_id: input.memberId,
        metadata: {
          workspace_id: input.workspaceId,
          old_role: targetMember.role,
          new_role: input.role,
        },
      })

      return updated
    }),

  // ============================================================
  // remove — ลบ member ออกจาก workspace
  // ============================================================
  remove: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid('workspace ID ไม่ถูกต้อง'),
        memberId: z.string().uuid('member ID ไม่ถูกต้อง'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()

      await assertWorkspaceAdmin(supabase, input.workspaceId, ctx.user.id)

      // ดึง member ที่ต้องการลบ
      const { data: targetMember } = await supabase
        .from('workspace_members')
        .select('id, user_id, role')
        .eq('id', input.memberId)
        .eq('workspace_id', input.workspaceId)
        .maybeSingle()

      if (!targetMember) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ไม่พบสมาชิกนี้ใน workspace' })
      }

      // ห้ามลบตัวเอง
      if (targetMember.user_id === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'ไม่สามารถลบตัวเองออกจาก workspace ได้',
        })
      }

      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('id', input.memberId)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถลบสมาชิกได้',
          cause: error,
        })
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        actor_id: ctx.user.id,
        action: 'member.remove',
        resource_type: 'workspace_member',
        resource_id: input.memberId,
        metadata: { workspace_id: input.workspaceId },
      })

      return { success: true, removedId: input.memberId }
    }),
})
