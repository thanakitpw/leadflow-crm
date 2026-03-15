import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { Resend } from 'resend'
import { router, protectedProcedure } from '@/server/trpc'
import { createClient } from '@/lib/supabase/server'

// ============================================================
// Resend client
// ============================================================

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'RESEND_API_KEY ไม่ได้ตั้งค่า — กรุณาตั้งค่าก่อนจัดการ domain',
    })
  }
  return new Resend(apiKey)
}

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

      // Map DB columns → frontend-friendly shape
      return (data ?? []).map((d) => ({
        id: d.id,
        domain: d.domain,
        status: d.dkim_status === 'verified' && d.spf_status === 'verified' ? 'verified' : 'pending',
        dkim_verified: d.dkim_status === 'verified',
        spf_verified: d.spf_status === 'verified',
        dmarc_verified: d.dmarc_status === 'verified',
        daily_limit: d.daily_send_limit,
        warmup_enabled: d.warmup_enabled,
        created_at: d.created_at,
        last_verified_at: d.verified_at,
      }))
    }),

  // ----------------------------------------------------------
  // add — เพิ่ม domain
  // ----------------------------------------------------------
  add: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        domain: z.string().min(3).regex(/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/, 'กรุณาใส่ domain เช่น bestsolutionscorp.com (ไม่ใช่อีเมล)'),
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

      // ลงทะเบียน domain กับ Resend API
      const resend = getResend()
      let resendDomain: { id: string; records: Array<{ type: string; name: string; value: string; record: string }> }
      try {
        const result = await resend.domains.create({ name: input.domain })
        if (result.error || !result.data) {
          throw new Error(result.error?.message ?? 'Resend domain creation failed')
        }
        resendDomain = result.data as typeof resendDomain
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `ไม่สามารถลงทะเบียน domain กับ Resend ได้: ${err instanceof Error ? err.message : 'unknown error'}`,
        })
      }

      // ดึง DNS records จาก Resend (log เพื่อ debug)
      console.log('[domain.add] Resend records:', JSON.stringify(resendDomain.records, null, 2))

      // Resend ส่ง records มาเป็น array — match ด้วยหลายเงื่อนไขเพื่อความยืดหยุ่น
      const dkimRec = resendDomain.records?.find((r: Record<string, string>) =>
        r.record === 'DKIM' || r.type === 'DKIM' || r.name?.includes('._domainkey')
      )
      const spfRec = resendDomain.records?.find((r: Record<string, string>) =>
        r.record === 'SPF' || r.type === 'MX' || r.name?.startsWith('send')
      )
      const dmarcRec = resendDomain.records?.find((r: Record<string, string>) =>
        r.record === 'DMARC' || r.name?.includes('_dmarc') || r.value?.includes('dmarc')
      )

      const { data, error } = await supabase
        .from('sending_domains')
        .insert({
          workspace_id: input.workspaceId,
          domain: input.domain,
          resend_domain_id: resendDomain.id,
          dkim_status: 'pending',
          spf_status: 'pending',
          dmarc_status: 'pending',
          dkim_record: dkimRec?.value ?? null,
          spf_record: spfRec?.value ?? null,
          dmarc_record: dmarcRec?.value ?? null,
          daily_send_limit: input.dailyLimit,
          warmup_enabled: false,
        })
        .select('*')
        .single()

      if (error || !data) {
        console.error('Domain insert error:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `ไม่สามารถเพิ่ม domain ได้: ${error?.message ?? 'unknown error'}`,
          cause: error,
        })
      }

      // DNS records จาก Resend จริง
      const dnsRecords = {
        dkim: {
          type: dkimRec?.type ?? 'TXT',
          host: dkimRec?.name ?? `resend._domainkey.${input.domain}`,
          value: dkimRec?.value ?? '',
        },
        spf: {
          type: spfRec?.type ?? 'TXT',
          host: spfRec?.name ?? input.domain,
          value: spfRec?.value ?? '',
        },
        dmarc: {
          type: dmarcRec?.type ?? 'TXT',
          host: dmarcRec?.name ?? `_dmarc.${input.domain}`,
          value: dmarcRec?.value ?? '',
        },
      }

      return {
        id: data.id,
        domain: data.domain,
        status: 'pending',
        dkim_verified: false,
        spf_verified: false,
        dmarc_verified: false,
        daily_limit: data.daily_send_limit,
        warmup_enabled: data.warmup_enabled,
        created_at: data.created_at,
        last_verified_at: null,
        dnsRecords,
      }
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

      if (!domain.resend_domain_id) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Domain นี้ยังไม่ได้ลงทะเบียนกับ Resend — กรุณาลบแล้วเพิ่มใหม่',
        })
      }

      // เรียก Resend API เพื่อเช็คสถานะ verification จริง
      const resend = getResend()
      let resendDomain: { status: string; records: Array<{ type: string; name: string; value: string; record: string; status: string }> }
      try {
        // Trigger verification first
        await resend.domains.verify(domain.resend_domain_id)
        // Then get updated status
        const result = await resend.domains.get(domain.resend_domain_id)
        if (result.error || !result.data) {
          throw new Error(result.error?.message ?? 'Failed to get domain status')
        }
        resendDomain = result.data as typeof resendDomain
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `ไม่สามารถตรวจสอบกับ Resend ได้: ${err instanceof Error ? err.message : 'unknown error'}`,
        })
      }

      // Map Resend record statuses
      const dkimRec = resendDomain.records?.find((r: Record<string, string>) =>
        r.record === 'DKIM' || r.type === 'DKIM' || r.name?.includes('._domainkey')
      )
      const spfRec = resendDomain.records?.find((r: Record<string, string>) =>
        r.record === 'SPF' || r.type === 'MX' || r.name?.startsWith('send')
      )
      const dmarcRec = resendDomain.records?.find((r: Record<string, string>) =>
        r.record === 'DMARC' || r.name?.includes('_dmarc') || r.value?.includes('dmarc')
      )

      const dkimVerified = dkimRec?.status === 'verified' || resendDomain.status === 'verified'
      const spfVerified = spfRec?.status === 'verified' || resendDomain.status === 'verified'
      const dmarcVerified = dmarcRec?.status === 'verified' || resendDomain.status === 'verified'
      const allVerified = dkimVerified && spfVerified

      const { data: updated, error } = await supabase
        .from('sending_domains')
        .update({
          dkim_status: dkimVerified ? 'verified' : 'pending',
          spf_status: spfVerified ? 'verified' : 'pending',
          dmarc_status: dmarcVerified ? 'verified' : 'pending',
          dkim_record: dkimRec?.value ?? domain.dkim_record,
          spf_record: spfRec?.value ?? domain.spf_record,
          dmarc_record: dmarcRec?.value ?? domain.dmarc_record,
          verified_at: allVerified ? new Date().toISOString() : domain.verified_at,
        })
        .eq('id', input.domainId)
        .eq('workspace_id', input.workspaceId)
        .select('*')
        .single()

      if (error || !updated) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ไม่สามารถอัปเดตสถานะ domain ได้',
          cause: error,
        })
      }

      return {
        id: updated.id,
        domain: updated.domain,
        status: allVerified ? 'verified' : 'pending',
        dkim_verified: dkimVerified,
        spf_verified: spfVerified,
        dmarc_verified: dmarcVerified,
        daily_limit: updated.daily_send_limit,
        warmup_enabled: updated.warmup_enabled,
        created_at: updated.created_at,
        last_verified_at: updated.verified_at,
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
        .select('domain, resend_domain_id, dkim_record, spf_record, dmarc_record')
        .eq('id', input.domainId)
        .eq('workspace_id', input.workspaceId)
        .maybeSingle()

      if (!domain) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ไม่พบ domain นี้' })
      }

      // ถ้ามี resend_domain_id ให้ดึง DNS records จาก Resend API (ค่าล่าสุด)
      if (domain.resend_domain_id) {
        try {
          const resend = getResend()
          const result = await resend.domains.get(domain.resend_domain_id)
          if (result.data?.records) {
            const records = result.data.records as Array<Record<string, string>>
            const dkimRec = records.find((r) =>
              r.record === 'DKIM' || r.type === 'DKIM' || r.name?.includes('._domainkey')
            )
            const spfRec = records.find((r) =>
              r.record === 'SPF' || r.type === 'MX' || r.name?.startsWith('send')
            )
            const dmarcRec = records.find((r) =>
              r.record === 'DMARC' || r.name?.includes('_dmarc') || r.value?.includes('dmarc')
            )

            return {
              dkim: {
                type: dkimRec?.type ?? 'TXT' as const,
                host: dkimRec?.name ?? `resend._domainkey.${domain.domain}`,
                value: dkimRec?.value ?? '',
                status: dkimRec?.status,
              },
              spf: {
                type: spfRec?.type ?? 'TXT' as const,
                host: spfRec?.name ?? domain.domain,
                value: spfRec?.value ?? '',
                status: spfRec?.status,
              },
              dmarc: {
                type: dmarcRec?.type ?? 'TXT' as const,
                host: dmarcRec?.name ?? `_dmarc.${domain.domain}`,
                value: dmarcRec?.value ?? '',
                status: dmarcRec?.status,
              },
            }
          }
        } catch {
          // Fallback to DB values if Resend API fails
        }
      }

      return {
        dkim: {
          type: 'TXT' as const,
          host: `resend._domainkey.${domain.domain}`,
          value: domain.dkim_record ?? '',
        },
        spf: {
          type: 'TXT' as const,
          host: `@`,
          value: domain.spf_record ?? '',
        },
        dmarc: {
          type: 'TXT' as const,
          host: `_dmarc`,
          value: domain.dmarc_record ?? '',
        },
      }
    }),
})
