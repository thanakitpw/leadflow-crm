import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? 'dev-internal-secret'
const CRON_SECRET = process.env.CRON_SECRET ?? 'dev-cron-secret'

// ============================================================
// GET — เรียกโดย cron job เพื่อ process campaigns ที่ถึงเวลาส่ง
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ตรวจสอบ cron secret ผ่าน Authorization header
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    // หา campaigns ที่ status = 'scheduled' และถึงเวลาส่งแล้ว
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('id')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())

    if (error) {
      console.error('[cron/process-scheduled-campaigns] Query error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const triggered: string[] = []

    for (const campaign of campaigns ?? []) {
      // อัพเดทสถานะ → sending ก่อน trigger เพื่อป้องกัน double-send
      await supabase
        .from('campaigns')
        .update({ status: 'sending' })
        .eq('id', campaign.id)

      // Trigger send แบบ fire and forget
      void fetch(`${APP_URL}/api/internal/campaign-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign.id, secret: INTERNAL_SECRET }),
      }).catch((err) =>
        console.error(`[cron] Failed to trigger campaign ${campaign.id}:`, err),
      )

      triggered.push(campaign.id)
    }

    return NextResponse.json({
      ok:          true,
      triggered:   triggered.length,
      campaignIds: triggered,
    })
  } catch (error) {
    console.error('[cron/process-scheduled-campaigns] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
