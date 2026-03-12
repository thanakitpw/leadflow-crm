import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import { createClient } from '@/lib/supabase/server'

// ============================================================
// Schemas
// ============================================================

// action enum ต้องตรงกับ constraint ใน database migration
const activityActionSchema = z.enum([
  // Lead actions
  'lead.created',
  'lead.updated',
  'lead.deleted',
  'lead.bulk_created',
  'lead.bulk_deleted',
  'lead.status_changed',
  'lead.score_updated',
  'lead.tag_added',
  'lead.tag_removed',
  // Campaign actions
  'campaign.created',
  'campaign.updated',
  'campaign.deleted',
  'campaign.scheduled',
  'campaign.started',
  'campaign.paused',
  'campaign.cancelled',
  'campaign.completed',
  // Sequence actions
  'sequence.created',
  'sequence.updated',
  'sequence.deleted',
  'sequence.activated',
  'sequence.paused',
  'sequence.archived',
  'sequence.enrolled',
  'sequence.completed',
  // Template actions
  'template.created',
  'template.updated',
  'template.deleted',
  'template.duplicated',
  // Domain actions
  'domain.added',
  'domain.verified',
  'domain.deleted',
  // Member actions
  'member.invited',
  'member.role_changed',
  'member.removed',
  // Email events (system-generated)
  'email.sent',
  'email.opened',
  'email.clicked',
  'email.bounced',
  // Report actions
  'report.created',
  'report.updated',
  'report.deleted',
  'report.shared',
])

const resourceTypeSchema = z.enum([
  'lead',
  'campaign',
  'sequence',
  'template',
  'domain',
  'member',
  'report',
])

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

export const activityRouter = router({
  // ----------------------------------------------------------
  // list — ดึง activity_feed แบบ cursor-based pagination
  // cursor = occurred_at ของ entry ล่าสุดที่เห็น
  // ----------------------------------------------------------
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        limit: z.number().int().min(1).max(50).default(20),
        cursor: z.string().datetime().optional(), // occurred_at ของ item ล่าสุด
        // filter ตาม action group
        resourceType: resourceTypeSchema.optional(),
        userId: z.string().uuid().optional(), // filter เฉพาะ activity ของ user นี้
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      let query = supabase
        .from('activity_feed')
        .select(
          `
          id, action, resource_type, resource_id, resource_name,
          metadata, occurred_at,
          profiles ( id, full_name, avatar_url )
        `,
        )
        .eq('workspace_id', input.workspaceId)
        .order('occurred_at', { ascending: false })
        // ดึง limit + 1 เพื่อรู้ว่ามีหน้าต่อไปอีกหรือไม่
        .limit(input.limit + 1)

      // cursor-based pagination: ดึงเฉพาะรายการที่เก่ากว่า cursor
      if (input.cursor) {
        query = query.lt('occurred_at', input.cursor)
      }

      // filter ตาม resource type
      if (input.resourceType) {
        query = query.eq('resource_type', input.resourceType)
      }

      // filter ตาม user
      if (input.userId) {
        query = query.eq('user_id', input.userId)
      }

      const { data, error } = await query

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถดึง activity feed ได้',
          cause: error,
        })
      }

      const items = data ?? []
      const hasNextPage = items.length > input.limit

      // ตัด item ส่วนเกินออก
      const result = hasNextPage ? items.slice(0, input.limit) : items

      // nextCursor = occurred_at ของ item สุดท้ายในผลลัพธ์
      const nextCursor =
        hasNextPage && result.length > 0
          ? result[result.length - 1].occurred_at
          : undefined

      return {
        items: result,
        nextCursor,
        hasNextPage,
      }
    }),

  // ----------------------------------------------------------
  // create — บันทึก activity entry
  // ใช้ internal หรือเรียกจาก router อื่นหลังทำ action
  // ----------------------------------------------------------
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        action: activityActionSchema,
        resourceType: resourceTypeSchema.optional(),
        resourceId: z.string().uuid().optional(),
        resourceName: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { data, error } = await supabase
        .from('activity_feed')
        .insert({
          workspace_id: input.workspaceId,
          user_id: ctx.user.id,
          action: input.action,
          resource_type: input.resourceType ?? null,
          resource_id: input.resourceId ?? null,
          resource_name: input.resourceName ?? null,
          metadata: input.metadata ?? null,
        })
        .select('id, action, occurred_at')
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถบันทึก activity ได้',
          cause: error,
        })
      }

      return data
    }),

  // ----------------------------------------------------------
  // getByResource — ดึง activity ของ resource เดียว
  // ใช้สำหรับ detail page (เช่น Campaign detail, Lead detail)
  // ----------------------------------------------------------
  getByResource: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        resourceType: resourceTypeSchema,
        resourceId: z.string().uuid(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { data, error } = await supabase
        .from('activity_feed')
        .select(
          `
          id, action, resource_type, resource_id, resource_name,
          metadata, occurred_at,
          profiles ( id, full_name, avatar_url )
        `,
        )
        .eq('workspace_id', input.workspaceId)
        .eq('resource_type', input.resourceType)
        .eq('resource_id', input.resourceId)
        .order('occurred_at', { ascending: false })
        .limit(input.limit)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถดึง activity ได้',
          cause: error,
        })
      }

      return data ?? []
    }),
})
