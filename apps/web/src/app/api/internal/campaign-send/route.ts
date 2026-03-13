import { NextRequest, NextResponse } from 'next/server'
import { sendCampaign } from '@/lib/email/send-campaign'

// Secret key สำหรับ internal API calls — ใช้ env var หรือ default สำหรับ dev
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? 'dev-internal-secret'

// ============================================================
// POST — รับ campaignId แล้วเรียก sendCampaign
// ============================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { campaignId?: string; secret?: string }
    const { campaignId, secret } = body

    // ตรวจสอบ secret ก่อนทุกครั้ง
    if (secret !== INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
    }

    const result = await sendCampaign(campaignId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[campaign-send] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
