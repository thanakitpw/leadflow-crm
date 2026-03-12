import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================
// GET Handler — Click Tracking Redirect
// ============================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
  const { eventId } = await params
  const { searchParams } = req.nextUrl

  // ดึง URL ปลายทางจาก query param
  const rawUrl = searchParams.get('url')

  // -- Validate: ต้องมี url --
  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // -- Validate: ป้องกัน open redirect — ต้องเป็น http/https เท่านั้น --
  let targetUrl: URL

  try {
    targetUrl = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: 'Invalid url parameter' }, { status: 400 })
  }

  if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
    return NextResponse.json(
      { error: 'URL must use http or https protocol' },
      { status: 400 },
    )
  }

  // -- Validate UUID format --
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  if (!uuidRegex.test(eventId)) {
    // redirect ทันทีโดยไม่ record
    return NextResponse.redirect(targetUrl.toString(), { status: 302 })
  }

  // Record click event แบบ fire-and-forget
  void recordClickEvent(eventId, targetUrl.toString())

  // Redirect ไปยัง URL ปลายทาง (302 Temporary Redirect)
  return NextResponse.redirect(targetUrl.toString(), { status: 302 })
}

// ============================================================
// Helpers
// ============================================================

async function recordClickEvent(contactId: string, clickedUrl: string): Promise<void> {
  try {
    const supabase = createAdminClient()

    // Lookup context จาก campaign_contact id
    const { data: contact } = await supabase
      .from('campaign_contacts')
      .select(
        `
        lead_id,
        message_id,
        campaigns ( id, workspace_id )
      `,
      )
      .eq('id', contactId)
      .maybeSingle()

    if (!contact) return

    const campaigns = contact.campaigns as unknown as { id: string; workspace_id: string } | null

    if (!campaigns) return

    await supabase.from('email_events').insert({
      workspace_id: campaigns.workspace_id,
      lead_id:      contact.lead_id ?? null,
      campaign_id:  campaigns.id,
      event_type:   'clicked',
      message_id:   (contact as { message_id?: string }).message_id ?? null,
      metadata:     { url: clickedUrl, contact_id: contactId },
    })
  } catch (err) {
    // Log แต่ไม่ throw — redirect ต้องทำงานเสมอ
    console.error('[track/click] Error recording click event:', err)
  }
}
