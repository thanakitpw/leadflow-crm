import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next") ?? "/"
  const error = requestUrl.searchParams.get("error")
  const errorDescription = requestUrl.searchParams.get("error_description")

  // Google OAuth หรือ provider อื่นส่ง error กลับมา → redirect ไป /login พร้อม error message
  if (error) {
    const loginUrl = new URL("/login", requestUrl.origin)
    loginUrl.searchParams.set(
      "error",
      errorDescription ?? "การเข้าสู่ระบบล้มเหลว กรุณาลองใหม่อีกครั้ง"
    )
    return NextResponse.redirect(loginUrl)
  }

  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      const loginUrl = new URL("/login", requestUrl.origin)
      loginUrl.searchParams.set("error", "เกิดข้อผิดพลาดในการยืนยันตัวตน กรุณาลองใหม่อีกครั้ง")
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
