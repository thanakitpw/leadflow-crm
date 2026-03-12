import { TRPCError } from '@trpc/server'
import { middleware } from '@/server/trpc'
import { createClient } from '@/lib/supabase/server'

// ============================================================
// isAuthenticated
// ตรวจสอบว่า user มี session อยู่ใน context แล้ว
// (ใช้ผ่าน protectedProcedure แทนการเรียก middleware นี้ตรง ๆ)
// ============================================================
export const isAuthenticated = middleware(({ ctx, next }) => {
  if (!ctx.user || !ctx.session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน',
    })
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      session: ctx.session,
    },
  })
})

// ============================================================
// isWorkspaceMember
// Factory: คืน middleware ที่รับ workspaceId จาก input แล้ว
// ตรวจสอบใน workspace_members
//
// ใช้: protectedProcedure.use(isWorkspaceMember('workspaceId'))
// หมายเหตุ: middleware นี้ต้องใช้หลัง .input() schema ที่มี field
//            ชื่อตาม inputKey เพื่อให้ tRPC parse input ก่อน
// ============================================================
export function isWorkspaceMember(inputKey: string = 'workspaceId') {
  return middleware(async ({ ctx, getRawInput, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' })
    }

    const rawInput = await getRawInput()
    const input = rawInput as Record<string, unknown>
    const workspaceId = input[inputKey] as string | undefined

    if (!workspaceId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'ไม่พบ workspace ID' })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', ctx.user.id)
      .maybeSingle()

    if (error || !data) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'คุณไม่มีสิทธิ์เข้าถึง workspace นี้',
      })
    }

    return next({
      ctx: {
        ...ctx,
        workspaceId,
        memberRole: data.role as 'agency_admin' | 'agency_member' | 'client_viewer',
      },
    })
  })
}

// ============================================================
// isWorkspaceAdmin
// Factory: เหมือน isWorkspaceMember แต่ต้องเป็น role 'agency_admin'
// ============================================================
export function isWorkspaceAdmin(inputKey: string = 'workspaceId') {
  return middleware(async ({ ctx, getRawInput, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' })
    }

    const rawInput = await getRawInput()
    const input = rawInput as Record<string, unknown>
    const workspaceId = input[inputKey] as string | undefined

    if (!workspaceId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'ไม่พบ workspace ID' })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', ctx.user.id)
      .eq('role', 'agency_admin')
      .maybeSingle()

    if (error || !data) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'เฉพาะ admin เท่านั้นที่สามารถทำรายการนี้ได้',
      })
    }

    return next({
      ctx: {
        ...ctx,
        workspaceId,
        memberRole: 'agency_admin' as const,
      },
    })
  })
}
