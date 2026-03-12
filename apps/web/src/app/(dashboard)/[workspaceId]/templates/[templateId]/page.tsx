"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Save,
  Send,
  Code,
  Eye,
  Plus,
  Loader2,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"

// ============================================================
// Constants
// ============================================================

const TEMPLATE_VARIABLES = [
  { label: "{{business_name}}", desc: "ชื่อธุรกิจ" },
  { label: "{{first_name}}", desc: "ชื่อ" },
  { label: "{{location}}", desc: "สถานที่" },
  { label: "{{category}}", desc: "หมวดธุรกิจ" },
  { label: "{{rating}}", desc: "คะแนน Google" },
]

const CATEGORIES = [
  "Cold Outreach",
  "Follow Up",
  "Introduction",
  "Promotion",
  "Newsletter",
  "Re-engagement",
]

// ============================================================
// Component
// ============================================================

export default function TemplateEditorPage() {
  const params = useParams()
  const router = useRouter()
  const workspaceId = params.workspaceId as string
  const templateId = params.templateId as string
  const isNew = templateId === "new"

  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [bodyHtml, setBodyHtml] = useState(
    `<p>สวัสดี {{first_name}},</p>\n\n<p>ฉันเห็น {{business_name}} และรู้สึกประทับใจมาก...</p>\n\n<p>ขอนัดหมายเพื่อพูดคุยได้ไหมครับ?</p>`,
  )
  const [category, setCategory] = useState("")
  const [view, setView] = useState<"code" | "preview">("code")
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
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
        setCategory(data.category ?? "")
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
      toast.error("กรุณาใส่ชื่อ template")
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
          category: category || undefined,
        })
        toast.success("สร้าง template แล้ว")
        router.replace(`/${workspaceId}/templates/${created.id}`)
      } else {
        await trpc.template.update.mutate({
          workspaceId,
          templateId,
          name: name.trim(),
          subject: subject.trim(),
          bodyHtml,
          category: category || null,
        })
        toast.success("บันทึก template แล้ว")
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถบันทึก template ได้"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const insertVariable = (variable: string) => {
    setBodyHtml((prev) => prev + variable)
    toast.success(`แทรก ${variable} แล้ว`)
  }

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
            กลับไปหน้า Templates
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-canvas)" }}>
      <div className="flex h-screen flex-col">
        {/* Top bar */}
        <div
          className="flex shrink-0 items-center justify-between border-b bg-white px-6 py-3"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex items-center gap-3">
            <Link href={`/${workspaceId}/templates`}>
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                กลับ
              </Button>
            </Link>
            <div>
              <h1 className="text-base font-semibold" style={{ color: "var(--color-ink)" }}>
                {isNew ? "สร้าง Template ใหม่" : name || "Template Editor"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info("ฟีเจอร์ส่งทดสอบจะพร้อมเร็วๆ นี้")}
              className="gap-2"
              style={{ borderRadius: "var(--radius-btn)" }}
            >
              <Send className="h-4 w-4" />
              ส่งทดสอบ
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-2"
              style={{
                backgroundColor: "var(--color-primary)",
                borderRadius: "var(--radius-btn)",
              }}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              บันทึก
            </Button>
          </div>
        </div>

        {/* Main Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel — Settings + Editor */}
          <div
            className="flex w-1/2 flex-col overflow-y-auto border-r"
            style={{ borderColor: "var(--color-border)" }}
          >
            {/* Meta fields */}
            <div
              className="border-b p-5"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tmpl-name" style={{ color: "var(--color-ink)" }}>
                    ชื่อ Template <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="tmpl-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="เช่น Cold Outreach — ร้านอาหาร"
                    style={{ borderRadius: "var(--radius-input)" }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tmpl-subject" style={{ color: "var(--color-ink)" }}>
                    Subject <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="tmpl-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="เช่น เราช่วย {{business_name}} ดึงลูกค้าใหม่ได้"
                    style={{ borderRadius: "var(--radius-input)" }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label style={{ color: "var(--color-ink)" }}>หมวดหมู่</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger style={{ borderRadius: "var(--radius-input)" }}>
                      <SelectValue placeholder="เลือกหมวดหมู่ (ไม่บังคับ)" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Variable buttons */}
            <div
              className="border-b px-5 py-3"
              style={{ borderColor: "var(--color-border)" }}
            >
              <p className="mb-2 text-xs font-medium" style={{ color: "var(--color-muted)" }}>
                แทรก Variables:
              </p>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => insertVariable(v.label)}
                    className="flex items-center gap-1 rounded px-2.5 py-1 text-xs font-mono transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: "var(--color-primary-light)",
                      color: "var(--color-primary)",
                      borderRadius: "var(--radius-badge)",
                    }}
                    title={v.desc}
                  >
                    <Plus className="h-3 w-3" />
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Body Editor */}
            <div className="flex flex-1 flex-col">
              <div
                className="flex items-center gap-1 border-b px-5 py-2"
                style={{ borderColor: "var(--color-border)" }}
              >
                <button
                  onClick={() => setView("code")}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: view === "code" ? "var(--color-primary-light)" : "transparent",
                    color: view === "code" ? "var(--color-primary)" : "var(--color-muted)",
                    borderRadius: "var(--radius-btn)",
                  }}
                >
                  <Code className="h-3.5 w-3.5" />
                  HTML
                </button>
                <button
                  onClick={() => setView("preview")}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    backgroundColor:
                      view === "preview" ? "var(--color-primary-light)" : "transparent",
                    color: view === "preview" ? "var(--color-primary)" : "var(--color-muted)",
                    borderRadius: "var(--radius-btn)",
                  }}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </button>
              </div>

              <div className="flex-1 p-5">
                {view === "code" ? (
                  <textarea
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    className="h-full min-h-[400px] w-full resize-none rounded border bg-slate-50 p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    style={{
                      borderColor: "var(--color-border)",
                      borderRadius: "var(--radius-input)",
                      color: "var(--color-ink)",
                    }}
                    placeholder="<p>เนื้อหาอีเมล HTML...</p>"
                    spellCheck={false}
                  />
                ) : (
                  <div
                    className="min-h-[400px] rounded border bg-white p-5 text-sm leading-relaxed"
                    style={{
                      borderColor: "var(--color-border)",
                      borderRadius: "var(--radius-input)",
                      color: "var(--color-ink)",
                    }}
                    dangerouslySetInnerHTML={{ __html: bodyHtml }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Panel — Live Preview */}
          <div className="flex w-1/2 flex-col overflow-y-auto bg-slate-100">
            <div
              className="border-b bg-white px-5 py-3"
              style={{ borderColor: "var(--color-border)" }}
            >
              <p className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
                Preview อีเมล (ตัวอย่าง)
              </p>
            </div>

            {/* Email mock */}
            <div className="flex-1 p-8">
              <div
                className="mx-auto max-w-lg rounded-xl border bg-white shadow-sm"
                style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
              >
                {/* Email header */}
                <div
                  className="border-b px-6 py-4"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: "var(--color-primary)" }}
                    >
                      LF
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                        LeadFlow Team
                      </p>
                      <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                        to: khun@business.com
                      </p>
                    </div>
                  </div>
                  <p
                    className="mt-3 text-base font-semibold"
                    style={{ color: "var(--color-ink)" }}
                  >
                    {subject
                      .replace("{{business_name}}", "ร้านอาหารทดสอบ")
                      .replace("{{first_name}}", "คุณ")
                      .replace("{{location}}", "กรุงเทพ")
                      .replace("{{category}}", "ร้านอาหาร")
                      .replace("{{rating}}", "4.5") || "(Subject)"}
                  </p>
                </div>

                {/* Email body */}
                <div
                  className="px-6 py-5 text-sm leading-relaxed"
                  style={{ color: "var(--color-ink)" }}
                  dangerouslySetInnerHTML={{
                    __html: bodyHtml
                      .replace(/\{\{business_name\}\}/g, "ร้านอาหารทดสอบ")
                      .replace(/\{\{first_name\}\}/g, "คุณ")
                      .replace(/\{\{location\}\}/g, "กรุงเทพ")
                      .replace(/\{\{category\}\}/g, "ร้านอาหาร")
                      .replace(/\{\{rating\}\}/g, "4.5"),
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
