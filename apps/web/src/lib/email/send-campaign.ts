import { createAdminClient } from '@/lib/supabase/admin'
import { replaceVariables } from '@/lib/email/template-variables'

const PYTHON_API_URL = process.env.PYTHON_API_URL ?? 'http://localhost:8000'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ============================================================
// Types
// ============================================================

interface Lead {
  id: string
  name: string
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  category: string | null
  workspace_id: string
}

interface Campaign {
  id: string
  workspace_id: string
  name: string
  status: string
  audience_filter: Record<string, unknown> | null
  template_id: string
  sending_domain_id: string | null
}

interface EmailTemplate {
  id: string
  subject: string
  body_html: string
  body_text: string | null
}

interface SendingDomain {
  id: string
  domain: string
  daily_send_limit: number
  warmup_enabled: boolean
  warmup_current_limit: number
}

interface SendResult {
  leadId: string
  email: string
  success: boolean
  messageId?: string
  error?: string
}

// ============================================================
// Tracking helpers
// ============================================================

/**
 * สร้าง open tracking pixel URL
 * event_id คือ campaign_contact.id ที่จะสร้างทีหลัง
 * ใช้ placeholder ชั่วคราว แล้วแทนที่หลัง INSERT
 */
function buildTrackingPixelHtml(campaignContactId: string): string {
  const url = `${APP_URL}/api/track/open/${campaignContactId}`
  return `<img src="${url}" width="1" height="1" alt="" style="display:none;" />`
}

/**
 * แทนที่ href ใน anchor tags ด้วย click tracking redirect
 * เฉพาะ http/https links
 */
function wrapLinksWithTracking(html: string, campaignContactId: string): string {
  return html.replace(
    /href="(https?:\/\/[^"]+)"/gi,
    (_match, originalUrl: string) => {
      const encoded = encodeURIComponent(originalUrl)
      const trackingUrl = `${APP_URL}/api/track/click/${campaignContactId}?url=${encoded}`
      return `href="${trackingUrl}"`
    },
  )
}

/**
 * สร้าง unsubscribe token แบบ base64 (workspace_id:email)
 * ต้องใช้ base64url-safe สำหรับ URL
 */
function buildUnsubscribeToken(workspaceId: string, email: string): string {
  return Buffer.from(`${workspaceId}:${email}`).toString('base64url')
}

/**
 * เพิ่ม unsubscribe footer HTML ก่อน </body> tag
 */
function appendUnsubscribeFooter(html: string, workspaceId: string, email: string): string {
  const token = buildUnsubscribeToken(workspaceId, email)
  const unsubUrl = `${APP_URL}/api/unsubscribe/${token}`

  const footer = `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #E5DDD6;text-align:center;font-size:12px;color:#7A6F68;font-family:sans-serif;">
  หากคุณไม่ต้องการรับอีเมลจากเราอีก
  <a href="${unsubUrl}" style="color:#1E3A5F;">คลิกที่นี่เพื่อยกเลิก</a>
</div>`

  if (html.includes('</body>')) {
    return html.replace('</body>', `${footer}</body>`)
  }

  return html + footer
}

// ============================================================
// Python API email send
// ============================================================

interface PythonSendPayload {
  from_name: string
  from_email: string
  to_email: string
  subject: string
  body_html: string
  body_text?: string
}

interface PythonSendResponse {
  message_id: string
}

async function callPythonEmailSend(payload: PythonSendPayload): Promise<string> {
  // Python API รับ from_email เดียว — ฝัง from_name ลงใน "Name <email>" format
  const fromEmailWithName = payload.from_name
    ? `${payload.from_name} <${payload.from_email}>`
    : payload.from_email

  const res = await fetch(`${PYTHON_API_URL}/api/v1/email/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from_email: fromEmailWithName,
      to_email:   payload.to_email,
      subject:    payload.subject,
      html_body:  payload.body_html,
      body_text:  payload.body_text,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Python API error ${res.status}: ${text}`)
  }

  const data = (await res.json()) as PythonSendResponse
  return data.message_id
}

// ============================================================
// Main: sendCampaign
// ============================================================

export interface SendCampaignResult {
  campaignId: string
  totalRecipients: number
  sent: number
  failed: number
  skipped: number
  results: SendResult[]
}

/**
 * ส่ง campaign email ไปยัง leads ที่ตรงกับ audience_filter
 *
 * Flow:
 * 1. Load campaign + template + domain
 * 2. Load matching leads
 * 3. Check domain send limits
 * 4. สำหรับแต่ละ lead: replace vars, add tracking, send, บันทึก result
 * 5. Update campaign status → 'sent'
 */
export async function sendCampaign(campaignId: string): Promise<SendCampaignResult> {
  const supabase = createAdminClient()

  // ----------------------------------------------------------
  // 1. Load campaign
  // ----------------------------------------------------------
  const { data: campaign, error: campaignErr } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (campaignErr || !campaign) {
    throw new Error(`Campaign not found: ${campaignId}`)
  }

  const typedCampaign = campaign as Campaign

  if (!['draft', 'scheduled', 'sending'].includes(typedCampaign.status)) {
    throw new Error(`Campaign status is "${typedCampaign.status}" — cannot send`)
  }

  // ----------------------------------------------------------
  // 2. Load template
  // ----------------------------------------------------------
  const { data: template, error: templateErr } = await supabase
    .from('email_templates')
    .select('id, subject, body_html, body_text')
    .eq('id', typedCampaign.template_id)
    .single()

  if (templateErr || !template) {
    throw new Error(`Email template not found: ${typedCampaign.template_id}`)
  }

  const typedTemplate = template as EmailTemplate

  // ----------------------------------------------------------
  // 3. Load sending domain
  // ----------------------------------------------------------
  let sendingDomain: SendingDomain | null = null

  if (typedCampaign.sending_domain_id) {
    const { data: domain } = await supabase
      .from('sending_domains')
      .select('id, domain, daily_send_limit, warmup_enabled, warmup_current_limit')
      .eq('id', typedCampaign.sending_domain_id)
      .single()

    sendingDomain = domain as SendingDomain | null
  }

  // คำนวณ effective daily limit
  const effectiveLimit = sendingDomain
    ? sendingDomain.warmup_enabled
      ? Math.min(sendingDomain.warmup_current_limit, sendingDomain.daily_send_limit)
      : sendingDomain.daily_send_limit
    : 50 // default fallback

  // ----------------------------------------------------------
  // 4. Load leads ตาม audience_filter
  // ----------------------------------------------------------
  const filter = typedCampaign.audience_filter ?? {}
  let leadsQuery = supabase
    .from('leads')
    .select('id, name, email, phone, website, address, category, workspace_id')
    .eq('workspace_id', typedCampaign.workspace_id)
    .not('email', 'is', null)
    .neq('email', '')

  // Apply audience filters
  if (filter.status && Array.isArray(filter.status) && filter.status.length > 0) {
    leadsQuery = leadsQuery.in('status', filter.status as string[])
  }
  if (filter.category && typeof filter.category === 'string') {
    leadsQuery = leadsQuery.eq('category', filter.category)
  }

  // จำกัดตาม effective limit
  leadsQuery = leadsQuery.limit(effectiveLimit)

  const { data: leads, error: leadsErr } = await leadsQuery

  if (leadsErr) {
    throw new Error(`Failed to load leads: ${leadsErr.message}`)
  }

  const typedLeads = (leads ?? []) as Lead[]

  // ----------------------------------------------------------
  // 5. Load unsubscribes เพื่อ skip
  // ----------------------------------------------------------
  const leadEmails = typedLeads.map((l) => l.email).filter(Boolean) as string[]

  const { data: unsubscribeRows } = await supabase
    .from('unsubscribes')
    .select('email')
    .eq('workspace_id', typedCampaign.workspace_id)
    .in('email', leadEmails)

  const unsubscribedEmails = new Set<string>(
    (unsubscribeRows ?? []).map((u: { email: string }) => u.email.toLowerCase()),
  )

  // ----------------------------------------------------------
  // 6. Update campaign status → 'sending'
  // ----------------------------------------------------------
  await supabase
    .from('campaigns')
    .update({ status: 'sending', started_at: new Date().toISOString() })
    .eq('id', campaignId)

  // ----------------------------------------------------------
  // 7. Send emails per lead
  // ----------------------------------------------------------
  const results: SendResult[] = []
  let sentCount = 0
  let failedCount = 0
  let skippedCount = 0

  const fromEmail = sendingDomain
    ? `noreply@${sendingDomain.domain}`
    : (process.env.DEFAULT_FROM_EMAIL ?? 'noreply@leadflow.app')

  for (const lead of typedLeads) {
    if (!lead.email) {
      skippedCount++
      continue
    }

    const emailLower = lead.email.toLowerCase()

    // Skip unsubscribed
    if (unsubscribedEmails.has(emailLower)) {
      skippedCount++
      results.push({
        leadId: lead.id,
        email: lead.email,
        success: false,
        error: 'unsubscribed',
      })
      continue
    }

    try {
      // -- สร้าง variable data จาก lead --
      const varData: Record<string, string> = {
        business_name: lead.name ?? '',
        first_name:    lead.name?.split(' ')[0] ?? '',
        location:      lead.address ?? '',
        category:      lead.category ?? '',
        email:         lead.email ?? '',
        phone:         lead.phone ?? '',
        website:       lead.website ?? '',
      }

      // -- Replace variables ใน subject และ body --
      const subject   = replaceVariables(typedTemplate.subject, varData)
      const bodyText  = typedTemplate.body_text
        ? replaceVariables(typedTemplate.body_text, varData)
        : undefined

      // -- INSERT campaign_contact ก่อนส่ง เพื่อเอา id ทำ tracking --
      const { data: contact, error: contactErr } = await supabase
        .from('campaign_contacts')
        .insert({
          campaign_id: campaignId,
          lead_id:     lead.id,
          status:      'pending',
        })
        .select('id')
        .single()

      if (contactErr || !contact) {
        throw new Error(`Cannot create campaign_contact: ${contactErr?.message}`)
      }

      const contactId = (contact as { id: string }).id

      // -- Build final HTML with tracking --
      let bodyHtml = replaceVariables(typedTemplate.body_html, varData)
      bodyHtml     = wrapLinksWithTracking(bodyHtml, contactId)
      bodyHtml     = appendUnsubscribeFooter(bodyHtml, typedCampaign.workspace_id, lead.email)
      bodyHtml     += buildTrackingPixelHtml(contactId)

      // -- Send via Python API --
      const messageId = await callPythonEmailSend({
        from_name:  'LeadFlow',
        from_email: fromEmail,
        to_email:   lead.email,
        subject,
        body_html:  bodyHtml,
        body_text:  bodyText,
      })

      // -- Update campaign_contact → sent --
      await supabase
        .from('campaign_contacts')
        .update({
          status:     'sent',
          sent_at:    new Date().toISOString(),
          message_id: messageId,
        })
        .eq('id', contactId)

      // -- INSERT email_event: sent --
      await supabase.from('email_events').insert({
        workspace_id: typedCampaign.workspace_id,
        lead_id:      lead.id,
        campaign_id:  campaignId,
        event_type:   'sent',
        message_id:   messageId,
        metadata:     { contact_id: contactId },
      })

      sentCount++
      results.push({ leadId: lead.id, email: lead.email, success: true, messageId })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)

      console.error(`[sendCampaign] Failed to send to ${lead.email}:`, errorMsg)

      failedCount++
      results.push({ leadId: lead.id, email: lead.email ?? '', success: false, error: errorMsg })

      // อัพเดท campaign_contact → failed (ถ้ามี contact อยู่แล้ว)
      // ใช้ upsert-like approach: หา contact แล้ว update
      const { data: existingContact } = await supabase
        .from('campaign_contacts')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('lead_id', lead.id)
        .maybeSingle()

      if (existingContact) {
        await supabase
          .from('campaign_contacts')
          .update({ status: 'failed', error_message: errorMsg })
          .eq('id', (existingContact as { id: string }).id)
      }
    }
  }

  // ----------------------------------------------------------
  // 8. Update campaign → 'sent'
  // ----------------------------------------------------------
  const totalRecipients = sentCount + failedCount + skippedCount

  await supabase
    .from('campaigns')
    .update({
      status:           'sent',
      completed_at:     new Date().toISOString(),
      total_recipients: totalRecipients,
    })
    .eq('id', campaignId)

  return {
    campaignId,
    totalRecipients,
    sent:    sentCount,
    failed:  failedCount,
    skipped: skippedCount,
    results,
  }
}
