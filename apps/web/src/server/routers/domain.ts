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

export const domainRouter = router({
  // ----------------------------------------------------------
  // list — ดึง sending domains ของ workspace
  // ----------------------------------------------------------
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { data, error } = await supabase
        .from('sending_domains')
        .select('*')
        .eq('workspace_id', input.workspaceId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถดึงรายการ domains ได้',
          cause: error,
        })
      }

      return data ?? []
    }),

  // ----------------------------------------------------------
  // add — เพิ่ม domain
  // ----------------------------------------------------------
  add: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        domain: z.string().min(3).regex(/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/, 'รูปแบบ domain ไม่ถูกต้อง'),
        dailyLimit: z.number().int().min(1).max(10000).default(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      // ตรวจสอบ duplicate
      const { data: existing } = await supabase
        .from('sending_domains')
        .select('id')
        .eq('workspace_id', input.workspaceId)
        .eq('domain', input.domain)
        .maybeSingle()

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Domain "${input.domain}" มีอยู่แล้วใน workspace นี้`,
        })
      }

      // สร้าง DNS records ที่ต้องการ (DKIM selector)
      const dkimSelector = `leadflow-${Date.now().toString(36)}`

      const { data, error } = await supabase
        .from('sending_domains')
        .insert({
          workspace_id: input.workspaceId,
          domain: input.domain,
          status: 'pending',
          dkim_selector: dkimSelector,
          daily_limit: input.dailyLimit,
          warmup_enabled: false,
          dkim_verified: false,
          spf_verified: false,
          dmarc_verified: false,
        })
        .select('*')
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถเพิ่ม domain ได้',
          cause: error,
        })
      }

      // DNS records ที่ต้องตั้งค่า
      const dnsRecords = {
        dkim: {
          type: 'TXT',
          host: `${dkimSelector}._domainkey.${input.domain}`,
          value: `v=DKIM1; k=rsa; p=<public_key_will_be_generated>`,
        },
        spf: {
          type: 'TXT',
          host: input.domain,
          value: `v=spf1 include:_spf.leadflow.app ~all`,
        },
        dmarc: {
          type: 'TXT',
          host: `_dmarc.${input.domain}`,
          value: `v=DMARC1; p=none; rua=mailto:dmarc@leadflow.app`,
        },
      }

      return { ...data, dnsRecords }
    }),

  // ----------------------------------------------------------
  // verify — trigger DNS verification
  // ----------------------------------------------------------
  verify: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        domainId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { data: domain } = await supabase
        .from('sending_domains')
        .select('*')
        .eq('id', input.domainId)
        .eq('workspace_id', input.workspaceId)
        .maybeSingle()

      if (!domain) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ไม่พบ domain นี้' })
      }

      // TODO: เรียก Python API เพื่อ trigger DNS verification จริง
      // ตอนนี้ simulate verification (ใน production จะเรียก external service)
      const pythonApiUrl = process.env.PYTHON_API_URL
      let dkimVerified = domain.dkim_verified
      let spfVerified = domain.spf_verified
      let dmarcVerified = domain.dmarc_verified

      if (pythonApiUrl) {
        try {
          const res = await fetch(`${pythonApiUrl}/api/domain/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: domain.domain, dkimSelector: domain.dkim_selector }),
          })
          if (res.ok) {
            const result = await res.json() as { dkim?: boolean; spf?: boolean; dmarc?: boolean }
            dkimVerified = result.dkim ?? false
            spfVerified = result.spf ?? false
            dmarcVerified = result.dmarc ?? false
          }
        } catch {
          // ถ้าเรียก Python API ไม่ได้ ให้ผ่านโดยไม่ error
        }
      }

      const newStatus = dkimVerified && spfVerified ? 'verified' : 'pending'

      const { data: updated, error } = await supabase
        .from('sending_domains')
        .update({
          dkim_verified: dkimVerified,
          spf_verified: spfVerified,
          dmarc_verified: dmarcVerified,
          status: newStatus,
          last_verified_at: new Date().toISOString(),
        })
        .eq('id', input.domainId)
        .eq('workspace_id', input.workspaceId)
        .select('*')
        .single()

      if (error || !updated) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถตรวจสอบ domain ได้',
          cause: error,
        })
      }

      return {
        ...updated,
        verificationResult: {
          dkim: dkimVerified,
          spf: spfVerified,
          dmarc: dmarcVerified,
        },
      }
    }),

  // ----------------------------------------------------------
  // delete — ลบ domain
  // ----------------------------------------------------------
  delete: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        domainId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { error } = await supabase
        .from('sending_domains')
        .delete()
        .eq('id', input.domainId)
        .eq('workspace_id', input.workspaceId)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถลบ domain ได้',
          cause: error,
        })
      }

      return { success: true, deletedId: input.domainId }
    }),

  // ----------------------------------------------------------
  // getDnsRecords — ดึง DNS records ที่ต้องตั้งค่า
  // ----------------------------------------------------------
  getDnsRecords: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        domainId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = await createClient()
      await verifyWorkspaceMember(supabase, ctx.user.id, input.workspaceId)

      const { data: domain } = await supabase
        .from('sending_domains')
        .select('domain, dkim_selector, dkim_public_key')
        .eq('id', input.domainId)
        .eq('workspace_id', input.workspaceId)
        .maybeSingle()

      if (!domain) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ไม่พบ domain นี้' })
      }

      return {
        dkim: {
          type: 'TXT' as const,
          host: `${domain.dkim_selector}._domainkey.${domain.domain}`,
          value: domain.dkim_public_key
            ? `v=DKIM1; k=rsa; p=${domain.dkim_public_key}`
            : `v=DKIM1; k=rsa; p=<กำลังสร้าง...>`,
        },
        spf: {
          type: 'TXT' as const,
          host: `@`,
          value: `v=spf1 include:_spf.leadflow.app ~all`,
        },
        dmarc: {
          type: 'TXT' as const,
          host: `_dmarc`,
          value: `v=DMARC1; p=none; rua=mailto:dmarc@leadflow.app`,
        },
      }
    }),
})
