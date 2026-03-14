"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Loader2, AlertTriangle, Monitor, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"

// ============================================================
// Constants
// ============================================================

const TEMPLATE_VARIABLES = [
  { label: "{{ชื่อร้าน}}", key: "business_name", sample: "ร้านอาหารทดสอบ" },
  { label: "{{ชื่อ}}", key: "first_name", sample: "สมชาย" },
  { label: "{{หมวดหมู่}}", key: "category", sample: "ร้านอาหาร" },
  { label: "{{ที่อยู่}}", key: "location", sample: "กรุงเทพ" },
  { label: "{{คะแนน}}", key: "rating", sample: "4.5" },
]

// sample data map for preview replacement
const SAMPLE_DATA: Record<string, string> = {
  "{{ชื่อร้าน}}": "ร้านอาหารทดสอบ",
  "{{business_name}}": "ร้านอาหารทดสอบ",
  "{{ชื่อ}}": "สมชาย",
  "{{first_name}}": "สมชาย",
  "{{หมวดหมู่}}": "ร้านอาหาร",
  "{{category}}": "ร้านอาหาร",
  "{{ที่อยู่}}": "กรุงเทพ",
  "{{location}}": "กรุงเทพ",
  "{{คะแนน}}": "4.5",
  "{{rating}}": "4.5",
}

function applyPreviewData(text: string): string {
  let result = text
  for (const [key, val] of Object.entries(SAMPLE_DATA)) {
    // escape key for regex
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    result = result.replace(new RegExp(escaped, "g"), val)
  }
  return result
}

// Highlight {{variables}} in plain text body for preview
function renderBodyWithHighlights(text: string): string {
  const withData = applyPreviewData(text)
  // wrap replaced values that came from variables with bold highlight
  // Since we already replaced, just return plain text wrapped in <p> tags
  return withData
    .split("\n\n")
    .map((para) => `<p style="margin:0 0 12px 0;">${para.replace(/\n/g, "<br/>")}</p>`)
    .join("")
}

// ============================================================
// Component
// ============================================================

export default function TemplateEditorPage() {
  const params = useParams()
  const router = useRouter()
  const workspaceId = params.workspaceId as string
  const templateId = params.templateId as string
  const isNew = templateId === "new"

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [bodyHtml, setBodyHtml] = useState(
    `สวัสดีครับ คุณ{{ชื่อ}},\n\nผมเห็น {{ชื่อร้าน}} และรู้สึกประทับใจมากครับ ร้านของคุณในหมวด {{หมวดหมู่}} ที่ {{ที่อยู่}} มีคะแนนรีวิวดีมาก\n\nเราช่วยเพิ่มลูกค้าใหม่ให้ร้านของคุณได้ครับ ขอนัดหมายพูดคุยได้ไหมครับ?\n\nขอบคุณครับ`,
  )
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop")
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [testSending, setTestSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // โหลด template ถ้าเป็นการแก้ไข
  useEffect(() => {
    if (isNew) return

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await trpc.template.getById.query({ workspaceId, templateId })
        setName(data.name)
        setSubject(data.subject)
        setBodyHtml(data.body_html ?? "")
      } catch {
        setError("ไม่พบ template นี้")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [workspaceId, templateId, isNew])

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("กรุณาใส่ชื่อเทมเพลต")
      return
    }
    if (!subject.trim()) {
      toast.error("กรุณาใส่ Subject")
      return
    }

    setSaving(true)
    try {
      if (isNew) {
        const created = await trpc.template.create.mutate({
          workspaceId,
          name: name.trim(),
          subject: subject.trim(),
          bodyHtml,
        })
        toast.success("สร้างเทมเพลตแล้ว")
        router.replace(`/${workspaceId}/templates/${created.id}`)
      } else {
        await trpc.template.update.mutate({
          workspaceId,
          templateId,
          name: name.trim(),
          subject: subject.trim(),
          bodyHtml,
          category: null,
        })
        toast.success("บันทึกเทมเพลตแล้ว")
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถบันทึกเทมเพลตได้"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleTestSend = async () => {
    if (isNew) {
      toast.info("กรุณาบันทึกเทมเพลตก่อนส่งทดสอบ")
      return
    }
    setTestSending(true)
    try {
      await trpc.template.testSend.mutate({
        workspaceId,
        templateId,
        toEmail: "test@leadflow.co.th",
      })
      toast.success("ส่งอีเมลทดสอบแล้ว")
    } catch {
      toast.info("ฟีเจอร์ส่งทดสอบจะพร้อมเร็วๆ นี้")
    } finally {
      setTestSending(false)
    }
  }

  // Insert variable at cursor position in textarea
  const insertVariable = useCallback((varLabel: string) => {
    const textarea = textareaRef.current
    if (!textarea) {
      setBodyHtml((prev) => prev + varLabel)
      toast.success(`แทรก ${varLabel} แล้ว`)
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const before = textarea.value.slice(0, start)
    const after = textarea.value.slice(end)
    const newValue = before + varLabel + after

    setBodyHtml(newValue)
    toast.success(`แทรก ${varLabel} แล้ว`)

    // restore cursor position after state update
    requestAnimationFrame(() => {
      textarea.focus()
      const newCursorPos = start + varLabel.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    })
  }, [])

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "var(--color-canvas)" }}
      >
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--color-primary)" }} />
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3"
        style={{ backgroundColor: "var(--color-canvas)" }}
      >
        <AlertTriangle className="h-8 w-8" style={{ color: "var(--color-danger)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
          {error}
        </p>
        <Link href={`/${workspaceId}/templates`}>
          <Button variant="outline" size="sm">
            กลับไปหน้าเทมเพลต
          </Button>
        </Link>
      </div>
    )
  }

  const previewSubject = applyPreviewData(subject)
  const previewBody = renderBodyWithHighlights(bodyHtml)

  return (
    <div className="flex h-screen flex-col" style={{ backgroundColor: "var(--color-canvas)" }}>
      {/* ── Header bar ── */}
      <header
        className="flex shrink-0 items-center justify-between border-b bg-white px-6"
        style={{ borderColor: "var(--color-border)", height: 56 }}
      >
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm">
          <Link
            href={`/${workspaceId}/templates`}
            className="font-medium transition-colors hover:opacity-70"
            style={{ color: "var(--color-muted)" }}
          >
            เทมเพลต
          </Link>
          <ChevronRight className="h-3.5 w-3.5" style={{ color: "var(--color-border)" }} />
          <span className="font-semibold" style={{ color: "var(--color-ink)" }}>
            {isNew ? "เทมเพลตใหม่" : name || "ไม่มีชื่อ"}
          </span>
        </nav>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestSend}
            disabled={testSending}
            className="flex items-center gap-1.5 border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-80 disabled:opacity-50"
            style={{
              borderColor: "var(--color-border)",
              borderRadius: "var(--radius-btn)",
              color: "var(--color-ink)",
              backgroundColor: "white",
            }}
          >
            {testSending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            ส่งทดสอบ
          </button>

          <Link href={`/${workspaceId}/templates`}>
            <button
              type="button"
              className="flex items-center gap-1.5 border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-80"
              style={{
                borderColor: "var(--color-border)",
                borderRadius: "var(--radius-btn)",
                color: "var(--color-ink)",
                backgroundColor: "white",
              }}
            >
              ทิ้ง
            </button>
          </Link>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: "var(--color-primary)",
              borderRadius: "var(--radius-btn)",
            }}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            บันทึก
          </button>
        </div>
      </header>

      {/* ── Main 2-panel area ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel: Editor ── */}
        <div
          className="flex w-1/2 flex-col overflow-y-auto border-r bg-white"
          style={{ borderColor: "var(--color-border)" }}
        >
          {/* Form fields */}
          <div className="space-y-5 p-6">
            {/* ชื่อเทมเพลต */}
            <div className="space-y-1.5">
              <Label
                htmlFor="tmpl-name"
                className="text-[13px] font-medium"
                style={{ color: "var(--color-ink)" }}
              >
                ชื่อเทมเพลต
              </Label>
              <Input
                id="tmpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น ไทย F&B v2"
                className="text-sm"
                style={{
                  borderRadius: "var(--radius-input)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-ink)",
                }}
              />
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <Label
                htmlFor="tmpl-subject"
                className="text-[13px] font-medium"
                style={{ color: "var(--color-ink)" }}
              >
                Subject
              </Label>
              <Input
                id="tmpl-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="เช่น เราช่วย {{ชื่อร้าน}} ดึงลูกค้าใหม่ได้"
                className="text-sm"
                style={{
                  borderRadius: "var(--radius-input)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-ink)",
                }}
              />
            </div>

            {/* Variables section */}
            <div className="space-y-2">
              <p className="text-[13px] font-medium" style={{ color: "var(--color-ink)" }}>
                ตัวแปร (Variables)
              </p>
              <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                คลิกเพื่อแทรกที่ตำแหน่ง cursor
              </p>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => insertVariable(v.label)}
                    className="cursor-pointer border font-mono text-xs transition-all hover:opacity-80 active:scale-95"
                    style={{
                      backgroundColor: "var(--color-primary-light)",
                      color: "var(--color-primary)",
                      borderColor: "transparent",
                      borderRadius: "var(--radius-badge)",
                      padding: "4px 10px",
                    }}
                    title={`ตัวอย่าง: ${v.sample}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* เนื้อหา textarea */}
            <div className="space-y-1.5">
              <Label
                htmlFor="tmpl-body"
                className="text-[13px] font-medium"
                style={{ color: "var(--color-ink)" }}
              >
                เนื้อหา
              </Label>
              <textarea
                id="tmpl-body"
                ref={textareaRef}
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                rows={16}
                className="w-full resize-none text-sm leading-relaxed outline-none transition-colors"
                style={{
                  border: `1px solid var(--color-border)`,
                  borderRadius: "var(--radius-input)",
                  color: "var(--color-ink)",
                  padding: "12px 14px",
                  backgroundColor: "var(--color-canvas)",
                  fontFamily: "inherit",
                }}
                placeholder={`สวัสดีครับ คุณ{{ชื่อ}},\n\nเนื้อหาอีเมลของคุณ...`}
                spellCheck={false}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-primary)"
                  e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary-light)"
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-border)"
                  e.currentTarget.style.boxShadow = "none"
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Right Panel: Live Preview ── */}
        <div
          className="flex w-1/2 flex-col overflow-y-auto"
          style={{ backgroundColor: "var(--color-canvas)" }}
        >
          {/* Preview toolbar */}
          <div
            className="flex shrink-0 items-center justify-between border-b bg-white px-6 py-3"
            style={{ borderColor: "var(--color-border)" }}
          >
            <span className="text-[13px] font-medium" style={{ color: "var(--color-ink)" }}>
              ตัวอย่าง
            </span>

            {/* Desktop / Mobile toggle */}
            <div
              className="flex items-center gap-0.5 rounded-lg p-1"
              style={{ backgroundColor: "var(--color-canvas)" }}
            >
              <button
                type="button"
                onClick={() => setPreviewMode("desktop")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  borderRadius: "var(--radius-btn)",
                  backgroundColor: previewMode === "desktop" ? "white" : "transparent",
                  color:
                    previewMode === "desktop" ? "var(--color-primary)" : "var(--color-muted)",
                  boxShadow:
                    previewMode === "desktop" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <Monitor className="h-3.5 w-3.5" />
                Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("mobile")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  borderRadius: "var(--radius-btn)",
                  backgroundColor: previewMode === "mobile" ? "white" : "transparent",
                  color: previewMode === "mobile" ? "var(--color-primary)" : "var(--color-muted)",
                  boxShadow:
                    previewMode === "mobile" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <Smartphone className="h-3.5 w-3.5" />
                Mobile
              </button>
            </div>
          </div>

          {/* Preview area */}
          <div className="flex flex-1 items-start justify-center p-8">
            <div
              className="w-full transition-all duration-300"
              style={{ maxWidth: previewMode === "mobile" ? 340 : 560 }}
            >
              {/* Email mock card */}
              <div
                className="overflow-hidden bg-white shadow-sm"
                style={{
                  borderRadius: "var(--radius-card)",
                  border: `1px solid var(--color-border)`,
                }}
              >
                {/* Sender row */}
                <div
                  className="flex items-center gap-3 border-b px-5 py-4"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  {/* Avatar */}
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    LF
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                      LeadFlow
                    </p>
                    <p className="truncate text-xs" style={{ color: "var(--color-muted)" }}>
                      outreach@restaurant-a.co.th
                    </p>
                  </div>
                </div>

                {/* Subject */}
                <div
                  className="border-b px-5 py-4"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <p className="text-base font-semibold" style={{ color: "var(--color-ink)" }}>
                    {previewSubject || "(ยังไม่ได้ใส่ Subject)"}
                  </p>
                </div>

                {/* Body */}
                <div className="px-5 py-5">
                  <div
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--color-ink)" }}
                    dangerouslySetInnerHTML={{ __html: previewBody }}
                  />

                  {/* CTA button */}
                  <div className="mt-6">
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="inline-block px-5 py-2.5 text-sm font-medium text-white"
                      style={{
                        backgroundColor: "var(--color-primary)",
                        borderRadius: "var(--radius-btn)",
                      }}
                    >
                      ดูรายละเอียด
                    </a>
                  </div>
                </div>

                {/* Footer */}
                <div
                  className="border-t px-5 py-3"
                  style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-canvas)" }}
                >
                  <p className="text-center text-xs" style={{ color: "var(--color-muted)" }}>
                    ส่งจาก LeadFlow ·{" "}
                    <span
                      className="cursor-pointer underline underline-offset-2 hover:opacity-70"
                      style={{ color: "var(--color-muted)" }}
                    >
                      ยกเลิกรับอีเมล
                    </span>
                  </p>
                </div>
              </div>

              {/* Preview note */}
              <p className="mt-3 text-center text-xs" style={{ color: "var(--color-muted)" }}>
                ตัวอย่างข้อมูล: ชื่อ = สมชาย, ร้าน = ร้านอาหารทดสอบ
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
