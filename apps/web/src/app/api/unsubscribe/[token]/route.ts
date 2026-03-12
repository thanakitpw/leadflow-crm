import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================
// Token helpers
// ============================================================

interface UnsubscribeToken {
  workspaceId: string
  email: string
}

/**
 * Decode base64url token → { workspaceId, email }
 * Format: base64url(workspaceId:email)
 */
function decodeToken(token: string): UnsubscribeToken | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    const colonIndex = decoded.indexOf(':')

    if (colonIndex === -1) return null

    const workspaceId = decoded.slice(0, colonIndex)
    const email       = decoded.slice(colonIndex + 1)

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (!uuidRegex.test(workspaceId)) return null
    if (!email || !email.includes('@')) return null

    return { workspaceId, email }
  } catch {
    return null
  }
}

// ============================================================
// HTML helpers
// ============================================================

function buildConfirmPage(email: string): string {
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ยืนยันการยกเลิกรับอีเมล</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Noto Sans Thai', sans-serif;
      background: #F7F5F2;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: #FFFFFF;
      border-radius: 12px;
      border: 1px solid #E5DDD6;
      padding: 48px 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    h1 { font-size: 20px; font-weight: 700; color: #1C1814; margin-bottom: 12px; }
    p  { font-size: 14px; color: #7A6F68; line-height: 1.6; margin-bottom: 24px; }
    .email { font-weight: 600; color: #1C1814; }
    .btn {
      display: inline-block;
      padding: 12px 28px;
      background: #1E3A5F;
      color: #FFFFFF;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
      border: none;
    }
    .btn:hover { background: #152C4A; }
    form { display: inline; }
  </style>
</head>
<body>
  <div class="card">
    <h1>ยืนยันการยกเลิกรับอีเมล</h1>
    <p>
      คุณต้องการยกเลิกรับอีเมลสำหรับ<br />
      <span class="email">${escapeHtml(email)}</span><br />
      ใช่หรือไม่?
    </p>
    <form method="POST">
      <button type="submit" class="btn">ยืนยันการยกเลิก</button>
    </form>
  </div>
</body>
</html>`
}

function buildSuccessPage(email: string): string {
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ยกเลิกรับอีเมลเรียบร้อย</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Noto Sans Thai', sans-serif;
      background: #F7F5F2;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: #FFFFFF;
      border-radius: 12px;
      border: 1px solid #E5DDD6;
      padding: 48px 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .icon  { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 20px; font-weight: 700; color: #1C1814; margin-bottom: 12px; }
    p  { font-size: 14px; color: #7A6F68; line-height: 1.6; }
    .email { font-weight: 600; color: #1C1814; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10003;</div>
    <h1>ยกเลิกรับอีเมลเรียบร้อย</h1>
    <p>
      เราได้ลบ <span class="email">${escapeHtml(email)}</span><br />
      ออกจากรายชื่อผู้รับอีเมลแล้ว<br />
      คุณจะไม่ได้รับอีเมลจากเราอีกต่อไป
    </p>
  </div>
</body>
</html>`
}

function buildErrorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ข้อผิดพลาด</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Noto Sans Thai', sans-serif;
      background: #F7F5F2;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: #FFFFFF;
      border-radius: 12px;
      border: 1px solid #E5DDD6;
      padding: 48px 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    h1 { font-size: 20px; font-weight: 700; color: #DC2626; margin-bottom: 12px; }
    p  { font-size: 14px; color: #7A6F68; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>เกิดข้อผิดพลาด</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ============================================================
// GET — Show confirmation page
// ============================================================

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params
  const decoded = decodeToken(token)

  if (!decoded) {
    return new NextResponse(buildErrorPage('ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  return new NextResponse(buildConfirmPage(decoded.email), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// ============================================================
// POST — Process unsubscribe
// ============================================================

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params
  const decoded = decodeToken(token)

  if (!decoded) {
    return new NextResponse(buildErrorPage('ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const { workspaceId, email } = decoded
  const supabase = createAdminClient()

  try {
    // -- 1. INSERT into unsubscribes (upsert เพื่อกันซ้ำ) --
    const { error: unsubErr } = await supabase
      .from('unsubscribes')
      .upsert(
        {
          workspace_id:    workspaceId,
          email:           email.toLowerCase(),
          reason:          'user_request',
          unsubscribed_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,email', ignoreDuplicates: true },
      )

    if (unsubErr) {
      console.error('[unsubscribe] Insert error:', unsubErr.message)
      throw new Error('ไม่สามารถบันทึกการยกเลิกได้')
    }

    // -- 2. หา lead ด้วย email + workspace_id --
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('email', email.toLowerCase())
      .maybeSingle()

    // -- 3. Update sequence_enrollments → 'unsubscribed' (ถ้ามี lead) --
    if (lead) {
      const { error: enrollErr } = await supabase
        .from('sequence_enrollments')
        .update({ status: 'unsubscribed' })
        .eq('lead_id', lead.id)
        .in('status', ['active', 'paused'])

      if (enrollErr) {
        // Log แต่ไม่ fail — unsubscribe ถือว่าสำเร็จแล้ว
        console.warn('[unsubscribe] Failed to update enrollments:', enrollErr.message)
      }

      // -- 4. INSERT email_event: unsubscribed --
      await supabase.from('email_events').insert({
        workspace_id: workspaceId,
        lead_id:      lead.id,
        event_type:   'unsubscribed',
        metadata:     { email, source: 'unsubscribe_link' },
      })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่คาดคิด'
    console.error('[unsubscribe] Error:', msg)

    return new NextResponse(buildErrorPage(msg), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  return new NextResponse(buildSuccessPage(email), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
