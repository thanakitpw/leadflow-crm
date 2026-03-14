"use client"

import { Sparkles, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface ComingSoonProps {
  title: string
  description?: string
  backHref?: string
  backLabel?: string
}

export default function ComingSoon({
  title,
  description = "ฟีเจอร์นี้กำลังอยู่ระหว่างการพัฒนา จะพร้อมใช้งานเร็ว ๆ นี้",
  backHref,
  backLabel = "กลับหน้าหลัก",
}: ComingSoonProps) {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ backgroundColor: "var(--color-canvas)" }}
    >
      <div className="flex flex-col items-center text-center">
        {/* Icon */}
        <div
          className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "var(--color-primary-light)" }}
        >
          <Sparkles className="h-10 w-10" style={{ color: "var(--color-primary)" }} />
        </div>

        {/* Badge */}
        <span
          className="mb-4 inline-block rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
          style={{
            backgroundColor: "#F5F3FF",
            color: "var(--color-ai)",
          }}
        >
          Coming Soon
        </span>

        {/* Title */}
        <h1
          className="mb-2 text-2xl font-bold"
          style={{ color: "var(--color-ink)" }}
        >
          {title}
        </h1>

        {/* Description */}
        <p
          className="mb-8 max-w-sm text-sm leading-relaxed"
          style={{ color: "var(--color-muted)" }}
        >
          {description}
        </p>

        {/* Back button */}
        {backHref && (
          <Link href={backHref}>
            <Button
              variant="outline"
              className="gap-2"
              style={{
                borderColor: "var(--color-border)",
                borderRadius: "var(--radius-btn)",
                color: "var(--color-ink)",
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}
