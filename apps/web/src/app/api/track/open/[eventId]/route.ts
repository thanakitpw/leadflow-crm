import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 1x1 transparent GIF (base64)
// แปลงจาก GIF89a spec — smallest possible transparent pixel
const TRANSPARENT_GIF_BASE64 =
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const TRANSPARENT_GIF_BUFFER = Buffer.from(TRANSPARENT_GIF_BASE64, 'base64')

// ============================================================
// GET Handler — Open Tracking Pixel
// ============================================================

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
  const { eventId } = await params

  // ตรวจสอบว่า eventId เป็น UUID format ก่อน query
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  if (!uuidRegex.test(eventId)) {
    // คืน pixel ปกติโดยไม่ record (ป้องกัน noise จาก invalid ids)
    return buildPixelResponse()
  }

  // Record open event แบบ fire-and-forget
  // ไม่รอ — ส่ง pixel กลับก่อนเพื่อ performance
  void recordOpenEvent(eventId)

  return buildPixelResponse()
}

// ============================================================
// Helpers
// ============================================================

function buildPixelResponse(): NextResponse {
  return new NextResponse(TRANSPARENT_GIF_BUFFER, {
    status: 200,
    headers: {
      'Content-Type':  'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma':        'no-cache',
      'Expires':       '0',
    },
  })
}

async function recordOpenEvent(contactId: string): Promise<void> {
  try {
    const supabase = createAdminClient()

    // Lookup campaign_contact เพื่อเอา context
    const { data: contact } = await supabase
      .from('campaign_contacts')
      .select(
        `
        lead_id,
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
      event_type:   'opened',
      metadata:     { contact_id: contactId, source: 'pixel' },
    })
  } catch (err) {
    // Log แต่ไม่ throw — pixel ต้องส่งกลับเสมอ
    console.error('[track/open] Error recording open event:', err)
  }
}
