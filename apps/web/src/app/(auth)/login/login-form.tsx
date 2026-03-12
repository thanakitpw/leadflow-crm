"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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
    <Card
      className="border-border shadow-sm"
      style={{ borderRadius: "var(--radius-card)" }}
    >
      <CardHeader className="pb-4 text-center">
        <div className="mb-2 flex justify-center">
          <span
            className="text-2xl font-extrabold tracking-tight"
            style={{ color: "var(--color-primary)" }}
          >
            LeadFlow
          </span>
        </div>
        <CardTitle
          className="text-xl font-bold"
          style={{ color: "var(--color-ink)" }}
        >
          เข้าสู่ระบบ
        </CardTitle>
        <CardDescription style={{ color: "var(--color-muted)" }}>
          ยินดีต้อนรับกลับมา กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              className="rounded-lg border px-4 py-3 text-sm"
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

          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="text-sm font-medium"
              style={{ color: "var(--color-ink)" }}
            >
              อีเมล
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="h-10 border-border bg-white text-sm placeholder:text-muted/60"
              style={{ borderRadius: "var(--radius-input)" }}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="password"
                className="text-sm font-medium"
                style={{ color: "var(--color-ink)" }}
              >
                รหัสผ่าน
              </Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium hover:underline"
                style={{ color: "var(--color-primary)" }}
              >
                ลืมรหัสผ่าน?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="h-10 border-border bg-white text-sm"
              style={{ borderRadius: "var(--radius-input)" }}
            />
          </div>

          <Button
            type="submit"
            disabled={loading || googleLoading}
            className="mt-2 h-10 w-full text-sm font-semibold text-white"
            style={{
              backgroundColor: loading
                ? "var(--color-primary-dark)"
                : "var(--color-primary)",
              borderRadius: "var(--radius-btn)",
            }}
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </Button>
        </form>

        <div className="mt-5 flex items-center gap-3">
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

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading || googleLoading}
          className="mt-4 flex h-10 w-full items-center justify-center gap-3 rounded-[var(--radius-btn)] border text-sm font-medium transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            borderColor: "var(--color-border)",
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

        <p
          className="mt-5 text-center text-sm"
          style={{ color: "var(--color-muted)" }}
        >
          ยังไม่มีบัญชี?{" "}
          <Link
            href="/signup"
            className="font-semibold hover:underline"
            style={{ color: "var(--color-primary)" }}
          >
            สมัครสมาชิก
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
