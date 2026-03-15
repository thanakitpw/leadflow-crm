"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import {
  CheckCircle2,
  Check,
  Send,
  Loader2,
  X,
  ChevronRight,
  Mail,
  FileText,
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

// ── Step Indicator ──────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "ข้อมูลทั่วไป" },
  { id: 2, label: "เลือกผู้รับ" },
  { id: 3, label: "เลือกเทมเพลต" },
  { id: 4, label: "กำหนดการส่ง" },
  { id: 5, label: "ตรวจสอบ & ส่ง" },
]

function StepIndicator({ activeStep }: { activeStep: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, index) => {
        const isCompleted = step.id < activeStep
        const isActive = step.id === activeStep
        const isFuture = step.id > activeStep

        return (
          <div key={step.id} className="flex items-center">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all"
                style={{
                  backgroundColor: isCompleted
                    ? "var(--color-primary)"
                    : isActive
                      ? "var(--color-primary)"
                      : "var(--color-subtle)",
                  color: isCompleted || isActive ? "#fff" : "var(--color-muted)",
                  border: isActive ? "2px solid var(--color-primary)" : "none",
                }}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4 stroke-[3]" />
                ) : (
                  step.id
                )}
              </div>
              <span
                className="whitespace-nowrap text-xs"
                style={{
                  color: isFuture ? "var(--color-muted)" : "var(--color-ink)",
                  fontWeight: isActive ? 700 : 400,
                }}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {index < STEPS.length - 1 && (
              <div
                className="mb-5 h-px w-12 shrink-0"
                style={{
                  backgroundColor:
                    step.id < activeStep
                      ? "var(--color-primary)"
                      : "var(--color-border)",
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Filter Pill ──────────────────────────────────────────────────────────────

function FilterPill({
  label,
  onRemove,
}: {
  label: string
  onRemove: () => void
}) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
      style={{
        backgroundColor: "var(--color-primary-light)",
        color: "var(--color-primary)",
        border: "1px solid var(--color-primary)",
      }}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="flex items-center justify-center rounded-full transition-opacity hover:opacity-70"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

// ── Day-of-week Pill ─────────────────────────────────────────────────────────

const DAYS = [
  { id: "mon", label: "จ" },
  { id: "tue", label: "อ" },
  { id: "wed", label: "พ" },
  { id: "thu", label: "พฤ" },
  { id: "fri", label: "ศ" },
  { id: "sat", label: "ส" },
  { id: "sun", label: "อา" },
]

function DayPill({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 min-w-9 items-center justify-center rounded-full text-sm font-medium transition-all"
      style={{
        backgroundColor: selected ? "var(--color-primary)" : "var(--color-subtle)",
        color: selected ? "#fff" : "var(--color-muted)",
        padding: "0 10px",
      }}
    >
      {label}
    </button>
  )
}

// ── Template Card (sidebar) ──────────────────────────────────────────────────

function TemplateCard({
  template,
  selected,
  compact,
  onSelect,
}: {
  template: Template
  selected: boolean
  compact?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-xl border text-left transition-all"
      style={{
        borderColor: selected ? "var(--color-primary)" : "var(--color-border)",
        backgroundColor: selected ? "var(--color-primary-light)" : "#fff",
        borderRadius: "var(--radius-card)",
        padding: compact ? "10px 12px" : "14px 16px",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: selected
              ? "var(--color-primary)"
              : "var(--color-subtle)",
          }}
        >
          <FileText
            className="h-4 w-4"
            style={{ color: selected ? "#fff" : "var(--color-muted)" }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold"
            style={{ color: "var(--color-ink)" }}
          >
            {template.name}
          </p>
          {!compact && (
            <p
              className="mt-0.5 truncate text-xs"
              style={{ color: "var(--color-muted)" }}
            >
              {template.subject}
            </p>
          )}
          {template.category && (
            <span
              className="mt-1.5 inline-block rounded px-1.5 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: "var(--color-subtle)",
                color: "var(--color-muted)",
                borderRadius: "var(--radius-badge)",
              }}
            >
              {template.category}
            </span>
          )}
        </div>
        {selected && !compact && (
          <CheckCircle2
            className="h-5 w-5 shrink-0"
            style={{ color: "var(--color-primary)" }}
          />
        )}
      </div>
    </button>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CreateCampaignPage() {
  const router = useRouter()
  const params = useParams()
  const workspaceId = params.workspaceId as string

  // ── Form state ──────────────────────────────────────────────────────────────
  const [name, setName] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [domainId, setDomainId] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterMinScore, setFilterMinScore] = useState("")
  const [filterMaxScore, setFilterMaxScore] = useState("")
  const [scheduleType, setScheduleType] = useState<"now" | "later">("later")
  const [scheduledAt, setScheduledAt] = useState("")
  const [dailyLimit, setDailyLimit] = useState("50")
  const [selectedDays, setSelectedDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri"])
  const [audienceTab, setAudienceTab] = useState<"leads" | "tags" | "csv">("leads")
  const [savingDraft, setSavingDraft] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)

  // ── Data state ──────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<Template[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [audienceCount, setAudienceCount] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  // ── Determine active step based on form progress ─────────────────────────
  const activeStep = (() => {
    if (!name.trim()) return 1
    if (!audienceCount && audienceCount !== 0) return 2
    if (!templateId) return 3
    if (!scheduledAt) return 4
    return 5
  })()

  // ── Load templates & domains ─────────────────────────────────────────────
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

  // ── Preview audience count ───────────────────────────────────────────────
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

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("กรุณาใส่ชื่อแคมเปญ")
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

      toast.success("สร้างแคมเปญเรียบร้อย")
      router.push(`/${workspaceId}/campaigns/${campaign.id}`)
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถสร้างแคมเปญได้"
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedTemplate = templates.find((t) => t.id === templateId)
  const selectedDomain = domains.find((d) => d.id === domainId)
  const verifiedDomains = domains.filter((d) => d.status === "verified")

  // ── Computed schedule summary ─────────────────────────────────────────────
  const dailyLimitNum = parseInt(dailyLimit) || 50
  const totalDays = audienceCount ? Math.ceil(audienceCount / dailyLimitNum) : 0

  // ── Loading ──────────────────────────────────────────────────────────────
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
      <form onSubmit={handleSubmit}>
        {/* ── Top Header Bar ──────────────────────────────────────────────── */}
        <div
          className="sticky top-0 z-20 border-b bg-white"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="mx-auto flex max-w-[1200px] items-center justify-between px-8 py-3">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <Link
                href={`/${workspaceId}/campaigns`}
                className="transition-opacity hover:opacity-70"
                style={{ color: "var(--color-muted)" }}
              >
                แคมเปญ
              </Link>
              <ChevronRight className="h-3.5 w-3.5" style={{ color: "var(--color-muted)" }} />
              <span className="font-semibold" style={{ color: "var(--color-ink)" }}>
                สร้างแคมเปญใหม่
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Link href={`/${workspaceId}/campaigns`}>
                <Button
                  variant="outline"
                  type="button"
                  size="sm"
                  style={{
                    borderRadius: "var(--radius-btn)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-ink)",
                  }}
                >
                  ยกเลิก
                </Button>
              </Link>
              <Button
                variant="outline"
                type="button"
                size="sm"
                disabled={savingDraft || !name.trim()}
                style={{
                  borderRadius: "var(--radius-btn)",
                  borderColor: "var(--color-primary)",
                  color: "var(--color-primary)",
                }}
                onClick={async () => {
                  if (!name.trim()) { toast.error("กรุณาใส่ชื่อแคมเปญ"); return }
                  setSavingDraft(true)
                  try {
                    const campaign = await trpc.campaign.create.mutate({
                      workspaceId,
                      name: name.trim(),
                      templateId: templateId || undefined,
                      sendingDomainId: domainId || undefined,
                      audienceFilter: {
                        status: filterStatus !== "all" ? (filterStatus as "new" | "contacted" | "qualified" | "unqualified") : undefined,
                        minScore: filterMinScore ? parseInt(filterMinScore) : undefined,
                        maxScore: filterMaxScore ? parseInt(filterMaxScore) : undefined,
                      },
                    })
                    toast.success("บันทึกร่างเรียบร้อย")
                    router.push(`/${workspaceId}/campaigns/${campaign.id}`)
                  } catch {
                    toast.error("ไม่สามารถบันทึกร่างได้")
                  } finally {
                    setSavingDraft(false)
                  }
                }}
              >
                {savingDraft && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                บันทึกร่าง
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting || !name.trim()}
                style={{
                  backgroundColor: "var(--color-primary)",
                  borderRadius: "var(--radius-btn)",
                  color: "#fff",
                }}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="mr-2 h-3.5 w-3.5" />
                )}
                ส่งแคมเปญ
              </Button>
            </div>
          </div>
        </div>

        {/* ── Step Indicator ──────────────────────────────────────────────── */}
        <div
          className="border-b bg-white"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="mx-auto flex max-w-[1200px] items-center justify-center px-8 py-5">
            <StepIndicator activeStep={activeStep} />
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="mx-auto max-w-[1200px] px-8 py-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">

            {/* ── Left: Main Content (65%) ──────────────────────────────── */}
            <div className="flex flex-1 flex-col gap-6">

              {/* Section 1 — ข้อมูลทั่วไป */}
              <section
                id="section-general"
                className="rounded-xl border bg-white p-6"
                style={{
                  borderColor: "var(--color-border)",
                  borderRadius: "var(--radius-card)",
                }}
              >
                <div className="mb-5 flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    1
                  </div>
                  <h2 className="text-base font-bold" style={{ color: "var(--color-ink)" }}>
                    ข้อมูลทั่วไป
                  </h2>
                </div>

                <div className="space-y-4">
                  {/* ชื่อแคมเปญ */}
                  <div className="space-y-1.5">
                    <Label htmlFor="name" style={{ color: "var(--color-ink)", fontSize: 13, fontWeight: 500 }}>
                      ชื่อแคมเปญ <span style={{ color: "var(--color-danger)" }}>*</span>
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="เช่น ติดต่อร้านอาหารในกรุงเทพ — เม.ย. 2026"
                      style={{ borderRadius: "var(--radius-input)" }}
                    />
                  </div>

                  {/* ส่งจากอีเมล */}
                  <div className="space-y-1.5">
                    <Label style={{ color: "var(--color-ink)", fontSize: 13, fontWeight: 500 }}>
                      ส่งจากอีเมล <span style={{ color: "var(--color-danger)" }}>*</span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Select value={domainId} onValueChange={setDomainId}>
                          <SelectTrigger style={{ borderRadius: "var(--radius-input)" }}>
                            <SelectValue placeholder="เลือก domain ที่ยืนยันแล้ว" />
                          </SelectTrigger>
                          <SelectContent>
                            {verifiedDomains.length === 0 ? (
                              <SelectItem value="_none" disabled>
                                ยังไม่มี verified domain
                              </SelectItem>
                            ) : (
                              verifiedDomains.map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                  {d.domain}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      {(selectedDomain || verifiedDomains.length > 0) && (
                        <div
                          className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold"
                          style={{
                            backgroundColor: "#DCFCE7",
                            color: "var(--color-success)",
                            borderRadius: "var(--radius-badge)",
                          }}
                        >
                          <Check className="h-3 w-3 stroke-[3]" />
                          SPF/DKIM ผ่าน
                        </div>
                      )}
                    </div>
                    {verifiedDomains.length === 0 && (
                      <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                        <Link
                          href={`/${workspaceId}/settings/domains`}
                          className="underline"
                          style={{ color: "var(--color-primary)" }}
                        >
                          ตั้งค่า domain
                        </Link>{" "}
                        ก่อนเพื่อส่งอีเมล
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* Section 2 — เลือกผู้รับ */}
              <section
                id="section-audience"
                className="rounded-xl border bg-white p-6"
                style={{
                  borderColor: "var(--color-border)",
                  borderRadius: "var(--radius-card)",
                }}
              >
                <div className="mb-5 flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    2
                  </div>
                  <h2 className="text-base font-bold" style={{ color: "var(--color-ink)" }}>
                    เลือกผู้รับ
                  </h2>
                </div>

                {/* Tab pills */}
                <div className="mb-4 flex gap-2">
                  {[
                    { id: "leads", label: "จาก Leads" },
                    { id: "tags", label: "จาก Tags" },
                    { id: "csv", label: "อัพโหลด CSV" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAudienceTab(tab.id as "leads" | "tags" | "csv")}
                      className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
                      style={{
                        backgroundColor:
                          audienceTab === tab.id
                            ? "var(--color-primary)"
                            : "var(--color-subtle)",
                        color:
                          audienceTab === tab.id ? "#fff" : "var(--color-muted)",
                        borderRadius: "var(--radius-badge)",
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {audienceTab === "leads" && (
                  <>
                    {/* Active filter pills (dynamic from actual filter state) */}
                    {(filterStatus !== "all" || filterMinScore || filterMaxScore) && (
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        {filterStatus !== "all" && (
                          <FilterPill
                            label={`สถานะ: ${filterStatus === "new" ? "ใหม่" : filterStatus === "contacted" ? "ติดต่อแล้ว" : filterStatus === "qualified" ? "คัดแล้ว" : "ไม่ผ่าน"}`}
                            onRemove={() => setFilterStatus("all")}
                          />
                        )}
                        {filterMinScore && (
                          <FilterPill
                            label={`AI Score ≥ ${filterMinScore}`}
                            onRemove={() => setFilterMinScore("")}
                          />
                        )}
                        {filterMaxScore && (
                          <FilterPill
                            label={`AI Score ≤ ${filterMaxScore}`}
                            onRemove={() => setFilterMaxScore("")}
                          />
                        )}
                        <FilterPill label="มีอีเมล" onRemove={() => {}} />
                      </div>
                    )}

                    {/* Quick filter row */}
                    <div className="mb-5 grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label style={{ color: "var(--color-ink)", fontSize: 12, fontWeight: 500 }}>
                          สถานะ
                        </Label>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                          <SelectTrigger
                            className="h-8 text-xs"
                            style={{ borderRadius: "var(--radius-input)" }}
                          >
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
                      <div className="space-y-1">
                        <Label style={{ color: "var(--color-ink)", fontSize: 12, fontWeight: 500 }}>
                          AI Score ขั้นต่ำ
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={filterMinScore}
                          onChange={(e) => setFilterMinScore(e.target.value)}
                          placeholder="0"
                          className="h-8 text-xs"
                          style={{ borderRadius: "var(--radius-input)" }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label style={{ color: "var(--color-ink)", fontSize: 12, fontWeight: 500 }}>
                          AI Score สูงสุด
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={filterMaxScore}
                          onChange={(e) => setFilterMaxScore(e.target.value)}
                          placeholder="100"
                          className="h-8 text-xs"
                          style={{ borderRadius: "var(--radius-input)" }}
                        />
                      </div>
                    </div>

                    {/* Result count */}
                    <div
                      className="rounded-xl p-4"
                      style={{
                        backgroundColor: "var(--color-primary-light)",
                        borderRadius: "var(--radius-card)",
                      }}
                    >
                      <div className="flex items-baseline gap-2">
                        <span
                          className="text-2xl font-bold"
                          style={{ color: "var(--color-primary)" }}
                        >
                          {audienceCount !== null
                            ? audienceCount.toLocaleString()
                            : "—"}
                        </span>
                        <span
                          className="text-sm font-semibold"
                          style={{ color: "var(--color-primary)" }}
                        >
                          รายชื่อที่จะได้รับ
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--color-muted)" }}>
                        leads ที่มีอีเมลตามเงื่อนไข filter
                      </p>
                    </div>
                  </>
                )}

                {audienceTab === "tags" && (
                  <div
                    className="flex items-center justify-center rounded-xl py-10"
                    style={{
                      backgroundColor: "var(--color-subtle)",
                      borderRadius: "var(--radius-card)",
                    }}
                  >
                    <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                      ฟีเจอร์กำลังพัฒนา
                    </p>
                  </div>
                )}

                {audienceTab === "csv" && (
                  <div
                    className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10"
                    style={{
                      borderColor: "var(--color-border)",
                      borderRadius: "var(--radius-card)",
                    }}
                  >
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-full"
                      style={{ backgroundColor: "var(--color-subtle)" }}
                    >
                      <Mail className="h-5 w-5" style={{ color: "var(--color-muted)" }} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                        ลาก CSV มาวางที่นี่
                      </p>
                      <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                        หรือ{" "}
                        <button
                          type="button"
                          className="underline"
                          style={{ color: "var(--color-primary)" }}
                        >
                          เลือกไฟล์
                        </button>
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* Section 3 — กำหนดการส่ง */}
              <section
                id="section-schedule"
                className="rounded-xl border bg-white p-6"
                style={{
                  borderColor: "var(--color-border)",
                  borderRadius: "var(--radius-card)",
                }}
              >
                <div className="mb-5 flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    4
                  </div>
                  <h2 className="text-base font-bold" style={{ color: "var(--color-ink)" }}>
                    กำหนดการส่ง
                  </h2>
                </div>

                <div className="space-y-5">
                  {/* เริ่มส่งเมื่อ */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label style={{ color: "var(--color-ink)", fontSize: 13, fontWeight: 500 }}>
                        เริ่มส่งเมื่อ
                      </Label>
                      <Input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                        style={{ borderRadius: "var(--radius-input)" }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label style={{ color: "var(--color-ink)", fontSize: 13, fontWeight: 500 }}>
                        จำกัดต่อวัน
                      </Label>
                      <Select value={dailyLimit} onValueChange={setDailyLimit}>
                        <SelectTrigger style={{ borderRadius: "var(--radius-input)" }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="20">20 อีเมล/วัน</SelectItem>
                          <SelectItem value="50">50 อีเมล/วัน</SelectItem>
                          <SelectItem value="100">100 อีเมล/วัน</SelectItem>
                          <SelectItem value="200">200 อีเมล/วัน</SelectItem>
                          <SelectItem value="500">500 อีเมล/วัน</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* วันที่ส่ง */}
                  <div className="space-y-2">
                    <Label style={{ color: "var(--color-ink)", fontSize: 13, fontWeight: 500 }}>
                      วันที่ส่ง
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map((day) => (
                        <DayPill
                          key={day.id}
                          label={day.label}
                          selected={selectedDays.includes(day.id)}
                          onClick={() =>
                            setSelectedDays((prev) =>
                              prev.includes(day.id)
                                ? prev.filter((d) => d !== day.id)
                                : [...prev, day.id]
                            )
                          }
                        />
                      ))}
                    </div>
                  </div>

                  {/* คาดว่าเสร็จ */}
                  {audienceCount !== null && totalDays > 0 && (
                    <div
                      className="rounded-lg px-4 py-3"
                      style={{
                        backgroundColor: "var(--color-subtle)",
                        borderRadius: "var(--radius-input)",
                      }}
                    >
                      <p className="text-sm" style={{ color: "var(--color-ink)" }}>
                        คาดว่าเสร็จ{" "}
                        <span className="font-semibold">
                          ~{totalDays} วันทำการ
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* ── Right: Sidebar (35%) ──────────────────────────────────── */}
            <div className="flex w-full flex-col gap-5 lg:w-[360px] lg:shrink-0">

              {/* Template Sidebar */}
              <div
                className="rounded-xl border bg-white p-5"
                style={{
                  borderColor: "var(--color-border)",
                  borderRadius: "var(--radius-card)",
                }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: "var(--color-primary)" }}
                    >
                      3
                    </div>
                    <h3 className="text-sm font-bold" style={{ color: "var(--color-ink)" }}>
                      เทมเพลต
                    </h3>
                  </div>
                  {templateId && (
                    <button
                      type="button"
                      className="text-xs font-medium underline transition-opacity hover:opacity-70"
                      style={{ color: "var(--color-primary)" }}
                      onClick={() => setTemplateId("")}
                    >
                      เปลี่ยน
                    </button>
                  )}
                </div>

                {templates.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                      ยังไม่มีเทมเพลต
                    </p>
                    <Link
                      href={`/${workspaceId}/templates`}
                      className="mt-1 inline-block text-xs underline"
                      style={{ color: "var(--color-primary)" }}
                    >
                      สร้างเทมเพลต
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Selected template (full) */}
                    {selectedTemplate ? (
                      <TemplateCard
                        template={selectedTemplate}
                        selected
                        onSelect={() => setTemplateId("")}
                      />
                    ) : (
                      <div
                        className="rounded-xl border-2 border-dashed px-4 py-4 text-center"
                        style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
                      >
                        <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                          เลือกเทมเพลตด้านล่าง
                        </p>
                      </div>
                    )}

                    {/* Alternative templates */}
                    <div className="space-y-2">
                      {templates
                        .filter((t) => t.id !== templateId)
                        .slice(0, 3)
                        .map((t) => (
                          <TemplateCard
                            key={t.id}
                            template={t}
                            selected={false}
                            compact
                            onSelect={() => setTemplateId(t.id)}
                          />
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Summary Sidebar */}
              <div
                className="rounded-xl border bg-white p-5"
                style={{
                  borderColor: "var(--color-border)",
                  borderRadius: "var(--radius-card)",
                }}
              >
                <h3
                  className="mb-4 text-sm font-bold"
                  style={{ color: "var(--color-ink)" }}
                >
                  สรุปก่อนส่ง
                </h3>

                <div className="space-y-3">
                  {[
                    {
                      label: "ผู้รับทั้งหมด",
                      value: audienceCount !== null
                        ? `${audienceCount.toLocaleString()} รายการ`
                        : "—",
                    },
                    {
                      label: "อีเมลต่อวัน",
                      value: `${dailyLimitNum} อีเมล`,
                    },
                    {
                      label: "ใช้เวลา",
                      value: totalDays > 0 ? `~${totalDays} วันทำการ` : "—",
                    },
                    {
                      label: "เริ่มส่ง",
                      value: scheduledAt
                        ? new Date(scheduledAt).toLocaleDateString("th-TH", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—",
                    },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                        {row.label}
                      </span>
                      <span
                        className="text-xs font-semibold"
                        style={{ color: "var(--color-ink)" }}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}

                  {/* คาดว่าเสร็จ */}
                  {totalDays > 0 && scheduledAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                        คาดว่าเสร็จ
                      </span>
                      <span className="text-xs font-semibold" style={{ color: "var(--color-success)" }}>
                        {(() => {
                          const d = new Date(scheduledAt)
                          d.setDate(d.getDate() + totalDays)
                          return d.toLocaleDateString("th-TH", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        })()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div
                  className="my-4 h-px"
                  style={{ backgroundColor: "var(--color-border)" }}
                />

                {/* CTA buttons */}
                <div className="space-y-2">
                  <Button
                    type="submit"
                    disabled={submitting || !name.trim()}
                    className="w-full"
                    style={{
                      backgroundColor: "var(--color-primary)",
                      borderRadius: "var(--radius-btn)",
                      color: "#fff",
                    }}
                  >
                    {submitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    ส่งแคมเปญ
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={sendingTest}
                    style={{
                      borderRadius: "var(--radius-btn)",
                      borderColor: "var(--color-primary)",
                      color: "var(--color-primary)",
                    }}
                    onClick={async () => {
                      setSendingTest(true)
                      try {
                        const result = await trpc.campaign.sendTestEmail.mutate({
                          workspaceId,
                          templateId: templateId || undefined,
                          domainId: domainId || undefined,
                        })
                        toast.success(`ส่งทดสอบไปที่ ${result.sentTo} แล้ว`)
                      } catch (err: unknown) {
                        const msg = err && typeof err === "object" && "message" in err
                          ? String((err as { message: string }).message)
                          : "ไม่สามารถส่งทดสอบได้"
                        toast.error(msg)
                      } finally {
                        setSendingTest(false)
                      }
                    }}
                  >
                    {sendingTest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    ส่งทดสอบก่อน
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
