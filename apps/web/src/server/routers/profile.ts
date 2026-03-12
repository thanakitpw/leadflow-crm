import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import { createClient } from '@/lib/supabase/server'

export const profileRouter = router({
  // ============================================================
  // get — ดึง profile ของ current user
  // ============================================================
  get: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, created_at, updated_at')
      .eq('id', ctx.user.id)
      .single()

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'ไม่สามารถดึงข้อมูลโปรไฟล์ได้',
        cause: error,
      })
    }

    if (!data) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'ไม่พบข้อมูลโปรไฟล์',
      })
    }

    return data
  }),

  // ============================================================
  // update — แก้ชื่อ / avatar ของ current user
  // ============================================================
  update: protectedProcedure
    .input(
      z.object({
        fullName: z.string().min(1, 'กรุณากรอกชื่อ').max(100).optional(),
        avatarUrl: z.string().url('URL ไม่ถูกต้อง').optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()

      const updateData: Record<string, unknown> = {}
      if (input.fullName !== undefined) updateData.full_name = input.fullName
      if (input.avatarUrl !== undefined) updateData.avatar_url = input.avatarUrl

      if (Object.keys(updateData).length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'ไม่มีข้อมูลที่ต้องการแก้ไข',
        })
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', ctx.user.id)
        .select('id, email, full_name, avatar_url, created_at, updated_at')
        .single()

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถแก้ไขโปรไฟล์ได้',
          cause: error,
        })
      }

      return data
    }),
})
