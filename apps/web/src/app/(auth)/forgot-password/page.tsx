"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/callback?next=/reset-password`,
    })

    if (error) {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง")
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
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
            ตรวจสอบอีเมลของคุณ
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--color-primary-light)" }}
          >
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: "var(--color-primary)" }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            ส่งลิงก์รีเซ็ตรหัสผ่านไปยัง{" "}
            <span className="font-semibold" style={{ color: "var(--color-ink)" }}>
              {email}
            </span>{" "}
            แล้ว กรุณาตรวจสอบอีเมลและคลิกลิงก์เพื่อตั้งรหัสผ่านใหม่
          </p>
          <p className="mt-4 text-xs" style={{ color: "var(--color-muted)" }}>
            ไม่ได้รับอีเมล? ตรวจสอบโฟลเดอร์ Spam หรือ{" "}
            <button
              onClick={() => setSent(false)}
              className="font-semibold hover:underline"
              style={{ color: "var(--color-primary)" }}
            >
              ส่งอีกครั้ง
            </button>
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
            <Link
              href="/login"
              className="font-semibold hover:underline"
              style={{ color: "var(--color-primary)" }}
            >
              กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </p>
        </CardContent>
      </Card>
    )
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
          ลืมรหัสผ่าน?
        </CardTitle>
        <CardDescription style={{ color: "var(--color-muted)" }}>
          กรอกอีเมลของคุณ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้
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

          <Button
            type="submit"
            disabled={loading}
            className="mt-2 h-10 w-full text-sm font-semibold text-white"
            style={{
              backgroundColor: loading ? "var(--color-primary-dark)" : "var(--color-primary)",
              borderRadius: "var(--radius-btn)",
            }}
          >
            {loading ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
          </Button>
        </form>

        <p
          className="mt-5 text-center text-sm"
          style={{ color: "var(--color-muted)" }}
        >
          จำรหัสผ่านได้แล้ว?{" "}
          <Link
            href="/login"
            className="font-semibold hover:underline"
            style={{ color: "var(--color-primary)" }}
          >
            เข้าสู่ระบบ
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
