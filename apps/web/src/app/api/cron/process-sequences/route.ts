import { NextRequest, NextResponse } from 'next/server'
import { processSequences } from '@/lib/email/process-sequences'

const CRON_SECRET = process.env.CRON_SECRET ?? 'dev-cron-secret'

// ============================================================
// GET — เรียกโดย cron job เพื่อ process sequence enrollments
// ส่งอีเมล step ถัดไปให้ leads ที่ถึงเวลาแล้ว
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ตรวจสอบ cron secret ผ่าน Authorization header
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processSequences()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[cron/process-sequences] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
