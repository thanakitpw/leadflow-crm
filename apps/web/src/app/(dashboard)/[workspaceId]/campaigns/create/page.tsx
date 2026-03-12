"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Calendar,
  Send,
  Users,
  Loader2,
  ChevronDown,
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

interface Template {
  id: string
  name: string
  subject: string
  category: string | null
}

interface Domain {
  id: string
  domain: string
  status: string
}

export default function CreateCampaignPage() {
  const router = useRouter()
  const params = useParams()
  const workspaceId = params.workspaceId as string

  const [name, setName] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [domainId, setDomainId] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterMinScore, setFilterMinScore] = useState("")
  const [filterMaxScore, setFilterMaxScore] = useState("")
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now")
  const [scheduledAt, setScheduledAt] = useState("")

  const [templates, setTemplates] = useState<Template[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [audienceCount, setAudienceCount] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  // ดึง templates และ domains
  useEffect(() => {
    async function load() {
      setLoadingData(true)
      try {
        const [tRes, dRes] = await Promise.all([
          trpc.template.list.query({ workspaceId, pageSize: 100 }),
          trpc.domain.list.query({ workspaceId }),
        ])
        setTemplates(tRes.templates as Template[])
        setDomains(dRes as Domain[])
      } catch {
        toast.error("ไม่สามารถดึงข้อมูลได้")
      } finally {
        setLoadingData(false)
      }
    }
    load()
  }, [workspaceId])

  // Preview audience count
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const result = await trpc.campaign.previewAudience.query({
          workspaceId,
          audienceFilter: {
            status:
              filterStatus !== "all"
                ? (filterStatus as "new" | "contacted" | "qualified" | "unqualified")
                : undefined,
            minScore: filterMinScore ? parseInt(filterMinScore) : undefined,
            maxScore: filterMaxScore ? parseInt(filterMaxScore) : undefined,
          },
        })
        setAudienceCount(result.count)
      } catch {
        // silent fail
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [workspaceId, filterStatus, filterMinScore, filterMaxScore])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("กรุณาใส่ชื่อ campaign")
      return
    }

    setSubmitting(true)
    try {
      const campaign = await trpc.campaign.create.mutate({
        workspaceId,
        name: name.trim(),
        templateId: templateId || undefined,
        sendingDomainId: domainId || undefined,
        audienceFilter: {
          status:
            filterStatus !== "all"
              ? (filterStatus as "new" | "contacted" | "qualified" | "unqualified")
              : undefined,
          minScore: filterMinScore ? parseInt(filterMinScore) : undefined,
          maxScore: filterMaxScore ? parseInt(filterMaxScore) : undefined,
        },
        scheduledAt:
          scheduleType === "later" && scheduledAt
            ? new Date(scheduledAt).toISOString()
            : undefined,
      })

      toast.success("สร้าง campaign เรียบร้อย")
      router.push(`/${workspaceId}/campaigns/${campaign.id}`)
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถสร้าง campaign ได้"
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingData) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "var(--color-canvas)" }}
      >
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--color-primary)" }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-canvas)" }}>
      <div className="mx-auto max-w-2xl px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link href={`/${workspaceId}/campaigns`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              กลับ
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
              สร้าง Campaign ใหม่
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ข้อมูลหลัก */}
          <div
            className="rounded-xl border bg-white p-6"
            style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
          >
            <h2 className="mb-4 text-base font-semibold" style={{ color: "var(--color-ink)" }}>
              ข้อมูล Campaign
            </h2>

            <div className="space-y-4">
              {/* ชื่อ */}
              <div className="space-y-1.5">
                <Label htmlFor="name" style={{ color: "var(--color-ink)" }}>
                  ชื่อ Campaign <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น ติดต่อร้านอาหารในกรุงเทพ — มี.ค. 2026"
                  style={{ borderRadius: "var(--radius-input)" }}
                />
              </div>

              {/* Template */}
              <div className="space-y-1.5">
                <Label style={{ color: "var(--color-ink)" }}>Email Template</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger style={{ borderRadius: "var(--radius-input)" }}>
                    <SelectValue placeholder="เลือก template (ไม่บังคับ)" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        ยังไม่มี templates
                      </SelectItem>
                    ) : (
                      templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {templates.length === 0 && (
                  <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                    <Link
                      href={`/${workspaceId}/templates`}
                      className="underline"
                      style={{ color: "var(--color-primary)" }}
                    >
                      สร้าง template ก่อน
                    </Link>{" "}
                    แล้วค่อยกลับมาสร้าง campaign
                  </p>
                )}
              </div>

              {/* Domain */}
              <div className="space-y-1.5">
                <Label style={{ color: "var(--color-ink)" }}>Sending Domain</Label>
                <Select value={domainId} onValueChange={setDomainId}>
                  <SelectTrigger style={{ borderRadius: "var(--radius-input)" }}>
                    <SelectValue placeholder="เลือก domain (ไม่บังคับ)" />
                  </SelectTrigger>
                  <SelectContent>
                    {domains
                      .filter((d) => d.status === "verified")
                      .map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.domain}
                        </SelectItem>
                      ))}
                    {domains.filter((d) => d.status === "verified").length === 0 && (
                      <SelectItem value="_none" disabled>
                        ยังไม่มี verified domain
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Audience Filter */}
          <div
            className="rounded-xl border bg-white p-6"
            style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold" style={{ color: "var(--color-ink)" }}>
                Audience Filter
              </h2>
              {audienceCount !== null && (
                <div
                  className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: "var(--color-primary-light)",
                    color: "var(--color-primary)",
                  }}
                >
                  <Users className="h-3.5 w-3.5" />
                  {audienceCount.toLocaleString()} recipients
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label style={{ color: "var(--color-ink)" }}>สถานะ Lead</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger style={{ borderRadius: "var(--radius-input)" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    <SelectItem value="new">ใหม่</SelectItem>
                    <SelectItem value="contacted">ติดต่อแล้ว</SelectItem>
                    <SelectItem value="qualified">คัดแล้ว</SelectItem>
                    <SelectItem value="unqualified">ไม่ผ่าน</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label style={{ color: "var(--color-ink)" }}>AI Score ขั้นต่ำ</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={filterMinScore}
                    onChange={(e) => setFilterMinScore(e.target.value)}
                    placeholder="0"
                    style={{ borderRadius: "var(--radius-input)" }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label style={{ color: "var(--color-ink)" }}>AI Score สูงสุด</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={filterMaxScore}
                    onChange={(e) => setFilterMaxScore(e.target.value)}
                    placeholder="100"
                    style={{ borderRadius: "var(--radius-input)" }}
                  />
                </div>
              </div>

              <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                จะส่งเฉพาะ leads ที่มีอีเมลเท่านั้น
              </p>
            </div>
          </div>

          {/* Schedule */}
          <div
            className="rounded-xl border bg-white p-6"
            style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
          >
            <h2 className="mb-4 text-base font-semibold" style={{ color: "var(--color-ink)" }}>
              กำหนดเวลาส่ง
            </h2>

            <div className="space-y-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setScheduleType("now")}
                  className="flex flex-1 items-center gap-3 rounded-lg border p-3 text-left transition-colors"
                  style={{
                    borderColor:
                      scheduleType === "now"
                        ? "var(--color-primary)"
                        : "var(--color-border)",
                    backgroundColor:
                      scheduleType === "now"
                        ? "var(--color-primary-light)"
                        : "transparent",
                    borderRadius: "var(--radius-input)",
                  }}
                >
                  <Send
                    className="h-4 w-4 shrink-0"
                    style={{
                      color:
                        scheduleType === "now"
                          ? "var(--color-primary)"
                          : "var(--color-muted)",
                    }}
                  />
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{
                        color:
                          scheduleType === "now"
                            ? "var(--color-primary)"
                            : "var(--color-ink)",
                      }}
                    >
                      ส่งทันที
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                      เริ่มส่งทันทีหลังกด submit
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setScheduleType("later")}
                  className="flex flex-1 items-center gap-3 rounded-lg border p-3 text-left transition-colors"
                  style={{
                    borderColor:
                      scheduleType === "later"
                        ? "var(--color-primary)"
                        : "var(--color-border)",
                    backgroundColor:
                      scheduleType === "later"
                        ? "var(--color-primary-light)"
                        : "transparent",
                    borderRadius: "var(--radius-input)",
                  }}
                >
                  <Calendar
                    className="h-4 w-4 shrink-0"
                    style={{
                      color:
                        scheduleType === "later"
                          ? "var(--color-primary)"
                          : "var(--color-muted)",
                    }}
                  />
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{
                        color:
                          scheduleType === "later"
                            ? "var(--color-primary)"
                            : "var(--color-ink)",
                      }}
                    >
                      กำหนดเวลา
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                      เลือกวันและเวลาที่ต้องการส่ง
                    </p>
                  </div>
                </button>
              </div>

              {scheduleType === "later" && (
                <div className="space-y-1.5">
                  <Label style={{ color: "var(--color-ink)" }}>วันและเวลา</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    style={{ borderRadius: "var(--radius-input)" }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <Link href={`/${workspaceId}/campaigns`}>
              <Button variant="outline" type="button" style={{ borderRadius: "var(--radius-btn)" }}>
                ยกเลิก
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={submitting || !name.trim()}
              style={{
                backgroundColor: "var(--color-primary)",
                borderRadius: "var(--radius-btn)",
              }}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ChevronDown className="mr-2 h-4 w-4 rotate-[-90deg]" />
              )}
              สร้าง Campaign
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
