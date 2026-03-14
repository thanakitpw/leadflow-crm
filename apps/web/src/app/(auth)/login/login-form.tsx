"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlError = searchParams.get("error")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(urlError)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง")
      setLoading(false)
      return
    }

    // Link pending invitations
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    if (authUser?.email) {
      await supabase
        .from("workspace_members")
        .update({ user_id: authUser.id, joined_at: new Date().toISOString() })
        .eq("invited_email", authUser.email)
        .is("user_id", null)
    }

    router.push("/")
    router.refresh()
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback`,
      },
    })

    if (error) {
      setError(
        "เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google กรุณาลองใหม่อีกครั้ง"
      )
      setGoogleLoading(false)
    }
  }

  return (
    /*
     * Fixed overlay เพื่อ override auth layout (max-w-md) ให้เป็น full-screen
     * บน mobile: ซ่อน left panel, แสดงเฉพาะ form (right panel)
     */
    <div
      className="fixed inset-0 flex"
      style={{ backgroundColor: "var(--color-canvas)" }}
    >
      {/* ===== Left Panel (desktop only) ===== */}
      <div
        className="hidden md:flex md:w-1/2 flex-col items-center justify-center px-12"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        <div className="max-w-sm w-full">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            {/* Logo icon: white rounded square with navy "L" */}
            <div
              className="flex items-center justify-center w-10 h-10 flex-shrink-0"
              style={{
                backgroundColor: "white",
                borderRadius: "var(--radius-card)",
              }}
            >
              <span
                className="text-lg font-extrabold leading-none"
                style={{ color: "var(--color-primary)" }}
              >
                L
              </span>
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">
              LeadFlow
            </span>
          </div>

          {/* Tagline heading */}
          <h1
            className="text-white font-bold mb-4 leading-snug"
            style={{ fontSize: "30px" }}
          >
            AI ที่ช่วยคุณหาลูกค้าใหม่
            <br />
            และส่งอีเมลอัตโนมัติ
          </h1>

          {/* Description */}
          <p
            className="text-sm leading-relaxed"
            style={{ color: "rgba(255,255,255,0.65)", fontSize: "14px" }}
          >
            ค้นหา Lead จาก Google Maps, ให้ AI วิเคราะห์และให้คะแนน
            <br />
            แล้วส่งอีเมลที่ปรับแต่งเฉพาะบุคคลโดยอัตโนมัติ
          </p>
        </div>
      </div>

      {/* ===== Right Panel ===== */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 overflow-y-auto bg-white">
        {/* Mobile logo (shown only on mobile when left panel is hidden) */}
        <div className="flex md:hidden items-center gap-2 mb-8">
          <div
            className="flex items-center justify-center w-8 h-8 flex-shrink-0"
            style={{
              backgroundColor: "var(--color-primary)",
              borderRadius: "var(--radius-badge)",
            }}
          >
            <span className="text-sm font-extrabold text-white leading-none">
              L
            </span>
          </div>
          <span
            className="text-xl font-bold"
            style={{ color: "var(--color-primary)" }}
          >
            LeadFlow
          </span>
        </div>

        <div className="w-full max-w-[400px]">
          {/* Heading */}
          <h2
            className="font-bold mb-1"
            style={{ fontSize: "28px", color: "var(--color-ink)" }}
          >
            เข้าสู่ระบบ
          </h2>
          <p
            className="text-sm mb-8"
            style={{ color: "var(--color-muted)" }}
          >
            ยินดีต้อนรับกลับ เข้าสู่ระบบเพื่อจัดการ Lead ของคุณ
          </p>

          {/* Error message */}
          {error && (
            <div
              className="mb-5 rounded-lg border px-4 py-3 text-sm"
              style={{
                backgroundColor: "#FEF2F2",
                borderColor: "#FECACA",
                color: "var(--color-danger)",
                borderRadius: "var(--radius-input)",
              }}
            >
              {error}
            </div>
          )}

          {/* Google OAuth button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading || googleLoading}
            className="flex h-12 w-full items-center justify-center gap-3 border text-sm font-medium transition-colors hover:bg-[#F7F5F2] disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: "var(--color-border)",
              borderRadius: "var(--radius-btn)",
              color: "var(--color-ink)",
              backgroundColor: "white",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z"
                fill="#4285F4"
              />
              <path
                d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z"
                fill="#34A853"
              />
              <path
                d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z"
                fill="#EA4335"
              />
            </svg>
            {googleLoading ? "กำลังเชื่อมต่อ..." : "เข้าสู่ระบบด้วย Google"}
          </button>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div
              className="h-px flex-1"
              style={{ backgroundColor: "var(--color-border)" }}
            />
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>
              หรือ
            </span>
            <div
              className="h-px flex-1"
              style={{ backgroundColor: "var(--color-border)" }}
            />
          </div>

          {/* Email + Password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email field */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm font-medium"
                style={{ color: "var(--color-ink)" }}
              >
                อีเมล
              </label>
              <input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading || googleLoading}
                className="w-full h-12 px-3 border text-sm outline-none transition-colors placeholder:text-[#B8B0A8] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  borderColor: "var(--color-border)",
                  borderRadius: "var(--radius-input)",
                  color: "var(--color-ink)",
                  backgroundColor: "white",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--color-primary)"
                  e.target.style.boxShadow =
                    "0 0 0 3px rgba(30,58,95,0.08)"
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--color-border)"
                  e.target.style.boxShadow = "none"
                }}
              />
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium"
                  style={{ color: "var(--color-ink)" }}
                >
                  รหัสผ่าน
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium hover:underline"
                  style={{ color: "var(--color-primary)" }}
                >
                  ลืมรหัสผ่าน?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading || googleLoading}
                className="w-full h-12 px-3 border text-sm outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  borderColor: "var(--color-border)",
                  borderRadius: "var(--radius-input)",
                  color: "var(--color-ink)",
                  backgroundColor: "white",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--color-primary)"
                  e.target.style.boxShadow =
                    "0 0 0 3px rgba(30,58,95,0.08)"
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--color-border)"
                  e.target.style.boxShadow = "none"
                }}
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="mt-2 h-12 w-full text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70"
              style={{
                backgroundColor:
                  loading ? "var(--color-primary-dark)" : "var(--color-primary)",
                borderRadius: "var(--radius-btn)",
              }}
              onMouseEnter={(e) => {
                if (!loading && !googleLoading) {
                  ;(e.target as HTMLButtonElement).style.backgroundColor =
                    "var(--color-primary-dark)"
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && !googleLoading) {
                  ;(e.target as HTMLButtonElement).style.backgroundColor =
                    "var(--color-primary)"
                }
              }}
            >
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>

          {/* Sign up link */}
          <p
            className="mt-6 text-center text-sm"
            style={{ color: "var(--color-muted)" }}
          >
            ยังไม่มีบัญชี?{" "}
            <Link
              href="/signup"
              className="font-semibold underline hover:opacity-80"
              style={{ color: "var(--color-primary)" }}
            >
              สมัครสมาชิก
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
