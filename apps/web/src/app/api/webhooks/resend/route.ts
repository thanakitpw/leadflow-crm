import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================
// Types — Resend Webhook Payload
// ============================================================

interface ResendWebhookEvent {
  type:
    | 'email.sent'
    | 'email.delivered'
    | 'email.opened'
    | 'email.clicked'
    | 'email.bounced'
    | 'email.complained'
  data: {
    email_id: string      // Resend message ID
    from:     string
    to:       string[]
    subject?: string
    click?: {
      link:       string
      timestamp:  string
      user_agent: string
    }
    bounce?: {
      message: string
    }
  }
}

// ============================================================
// Helpers
// ============================================================

/**
 * Lookup workspace_id จาก message_id ผ่าน campaign_contacts
 * คืน { workspaceId, leadId, campaignId } หรือ null ถ้าไม่พบ
 */
async function lookupContextByMessageId(
  supabase: ReturnType<typeof createAdminClient>,
  messageId: string,
): Promise<{ workspaceId: string; leadId: string | null; campaignId: string | null } | null> {
  // หา campaign_contact ที่ตรงกับ message_id
  const { data: contact } = await supabase
    .from('campaign_contacts')
    .select(
      `
      lead_id,
      campaigns ( id, workspace_id )
    `,
    )
    .eq('message_id', messageId)
    .maybeSingle()

  if (!contact) return null

  const campaigns = contact.campaigns as unknown as { id: string; workspace_id: string } | null

  if (!campaigns) return null

  return {
    workspaceId: campaigns.workspace_id,
    leadId:      contact.lead_id ?? null,
    campaignId:  campaigns.id,
  }
}

// ============================================================
// POST Handler
// ============================================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  // TODO: ติดตั้ง Resend webhook signature verification
  // Resend ใช้ svix สำหรับ signing — ต้องติดตั้ง @svix/webhook
  // และตรวจสอบ headers: svix-id, svix-timestamp, svix-signature
  // ด้วย RESEND_WEBHOOK_SECRET จาก environment variable
  //
  // ตัวอย่าง:
  // import { Webhook } from 'svix'
  // const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET!)
  // const payload = await wh.verify(rawBody, headers)

  let event: ResendWebhookEvent

  try {
    event = (await req.json()) as ResendWebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!event.type || !event.data?.email_id) {
    return NextResponse.json({ error: 'Missing event.type or event.data.email_id' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const messageId = event.data.email_id

  // Lookup context (workspace, lead, campaign) ด้วย message_id
  const context = await lookupContextByMessageId(supabase, messageId)

  // ถ้าไม่พบ context ให้ return 200 เพื่อไม่ให้ Resend retry
  // (อาจเป็น message จาก system อื่นหรือ test event)
  if (!context) {
    console.warn(`[resend-webhook] No context found for message_id: ${messageId}`)
    return NextResponse.json({ received: true, skipped: true })
  }

  const { workspaceId, leadId, campaignId } = context

  try {
    switch (event.type) {
      // --------------------------------------------------------
      // email.sent
      // --------------------------------------------------------
      case 'email.sent': {
        await supabase.from('email_events').insert({
          workspace_id: workspaceId,
          lead_id:      leadId,
          campaign_id:  campaignId,
          event_type:   'sent',
          message_id:   messageId,
        })
        break
      }

      // --------------------------------------------------------
      // email.delivered
      // --------------------------------------------------------
      case 'email.delivered': {
        await supabase.from('email_events').insert({
          workspace_id: workspaceId,
          lead_id:      leadId,
          campaign_id:  campaignId,
          event_type:   'delivered',
          message_id:   messageId,
        })
        break
      }

      // --------------------------------------------------------
      // email.opened
      // --------------------------------------------------------
      case 'email.opened': {
        await supabase.from('email_events').insert({
          workspace_id: workspaceId,
          lead_id:      leadId,
          campaign_id:  campaignId,
          event_type:   'opened',
          message_id:   messageId,
        })
        break
      }

      // --------------------------------------------------------
      // email.clicked
      // --------------------------------------------------------
      case 'email.clicked': {
        await supabase.from('email_events').insert({
          workspace_id: workspaceId,
          lead_id:      leadId,
          campaign_id:  campaignId,
          event_type:   'clicked',
          message_id:   messageId,
          metadata:     { url: event.data.click?.link ?? null },
        })
        break
      }

      // --------------------------------------------------------
      // email.bounced
      // --------------------------------------------------------
      case 'email.bounced': {
        // INSERT email_event
        await supabase.from('email_events').insert({
          workspace_id: workspaceId,
          lead_id:      leadId,
          campaign_id:  campaignId,
          event_type:   'bounced',
          message_id:   messageId,
          metadata:     { reason: event.data.bounce?.message ?? null },
        })

        // Update campaign_contact status → 'bounced'
        await supabase
          .from('campaign_contacts')
          .update({ status: 'bounced' })
          .eq('message_id', messageId)

        break
      }

      // --------------------------------------------------------
      // email.complained (spam complaint)
      // --------------------------------------------------------
      case 'email.complained': {
        // INSERT email_event
        await supabase.from('email_events').insert({
          workspace_id: workspaceId,
          lead_id:      leadId,
          campaign_id:  campaignId,
          event_type:   'complained',
          message_id:   messageId,
        })

        // เพิ่มอีเมลเข้า unsubscribes (upsert เพื่อกันซ้ำ)
        const toEmail = event.data.to?.[0] ?? null

        if (toEmail) {
          await supabase
            .from('unsubscribes')
            .upsert(
              {
                workspace_id:     workspaceId,
                email:            toEmail.toLowerCase(),
                reason:           'spam_complaint',
                unsubscribed_at:  new Date().toISOString(),
              },
              { onConflict: 'workspace_id,email', ignoreDuplicates: true },
            )

          // Update sequence_enrollments → 'unsubscribed' (ถ้ามี)
          if (leadId) {
            await supabase
              .from('sequence_enrollments')
              .update({ status: 'unsubscribed' })
              .eq('lead_id', leadId)
              .eq('status', 'active')
          }
        }

        break
      }

      default: {
        // Event type ที่ไม่รู้จัก — log แล้ว return 200
        console.warn(`[resend-webhook] Unknown event type: ${event.type}`)
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[resend-webhook] Error processing ${event.type}:`, msg)

    // Return 500 เพื่อให้ Resend retry
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
