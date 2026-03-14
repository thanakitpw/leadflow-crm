"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
  Clock,
  Users,
  Mail,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  TrendingUp,
  BarChart3,
  Settings,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"

// ============================================================
// Types
// ============================================================

type SequenceStatus = "draft" | "active" | "paused" | "archived"

interface SequenceStep {
  id: string
  step_order: number
  delay_days: number
  condition: string | null
  template_id: string
  email_templates: { id: string; name: string; subject: string } | null
}

interface Enrollment {
  id: string
  status: string
  current_step: number
  enrolled_at: string
  leads: { id: string; name: string; email: string | null } | null
}

interface SequenceDetail {
  id: string
  name: string
  status: SequenceStatus
  created_at: string
  steps: SequenceStep[]
  activeEnrollments: number
}

interface Template {
  id: string
  name: string
  subject: string
}

// ============================================================
// Helpers
// ============================================================

const STATUS_CONFIG: Record<SequenceStatus, { label: string; color: string; bg: string; dot: string }> = {
  draft:    { label: "ร่าง",           color: "#7A6F68", bg: "#F5F0EB", dot: "#7A6F68" },
  active:   { label: "กำลังทำงาน",    color: "#16A34A", bg: "#F0FDF4", dot: "#16A34A" },
  paused:   { label: "หยุดชั่วคราว",  color: "#D97706", bg: "#FEF3C7", dot: "#D97706" },
  archived: { label: "เก็บถาวร",      color: "#7A6F68", bg: "#F5F0EB", dot: "#7A6F68" },
}

// ============================================================
// Sub-components
// ============================================================

// Start node — trigger card
function StartNode() {
  return (
    <div
      className="relative flex items-start gap-4"
    >
      {/* Icon bubble */}
      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-white"
        style={{ borderColor: "var(--color-border)" }}
      >
        <Zap className="h-4 w-4" style={{ color: "var(--color-muted)" }} />
      </div>

      {/* Card */}
      <div
        className="flex-1 rounded-xl border bg-white px-4 py-3 shadow-sm"
        style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
          เริ่มต้น: เพิ่มลีดเข้าลำดับ
        </p>
        <p className="mt-0.5 text-xs" style={{ color: "var(--color-muted)" }}>
          Trigger · เมื่อลีดถูกเพิ่มเข้ามา
        </p>
      </div>
    </div>
  )
}

// Connector line + optional wait pill
function Connector({ delayDays }: { delayDays?: number }) {
  return (
    <div className="relative ml-5 flex flex-col items-center">
      {/* Top segment */}
      <div className="h-4 w-0.5" style={{ backgroundColor: "var(--color-border)" }} />

      {/* Wait pill — shown only when delay > 0 */}
      {delayDays !== undefined && delayDays > 0 && (
        <>
          <div
            className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
            style={{
              backgroundColor: "#FEF3C7",
              borderColor: "#FDE68A",
              color: "var(--color-warning)",
            }}
          >
            <Clock className="h-3 w-3" />
            รอ {delayDays} วัน
          </div>
          <div className="h-4 w-0.5" style={{ backgroundColor: "var(--color-border)" }} />
        </>
      )}

      {/* Short segment when no delay pill */}
      {(delayDays === undefined || delayDays === 0) && (
        <div className="h-2 w-0.5" style={{ backgroundColor: "var(--color-border)" }} />
      )}
    </div>
  )
}

// Email step node card
function EmailStepNode({
  step,
  isFirst,
  onDelete,
}: {
  step: SequenceStep
  isFirst: boolean
  onDelete: () => void
}) {
  return (
    <div className="flex items-start gap-4">
      {/* Icon bubble */}
      <div
        className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2"
        style={{
          borderColor: "var(--color-primary)",
          backgroundColor: "var(--color-primary-light)",
        }}
      >
        <Mail className="h-4 w-4" style={{ color: "var(--color-primary)" }} />
      </div>

      {/* Card */}
      <div
        className="flex-1 rounded-xl border bg-white px-4 py-3 shadow-sm"
        style={{
          borderColor: "var(--color-primary)",
          borderRadius: "var(--radius-card)",
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
              ส่งอีเมล: {step.email_templates?.name ?? "ไม่มี template"}
            </p>
            <p className="mt-0.5 truncate text-xs" style={{ color: "var(--color-muted)" }}>
              {step.email_templates
                ? `ใช้เทมเพลต '${step.email_templates.name}' · ${step.delay_days === 0 ? "ส่งทันที" : `ส่งหลัง ${step.delay_days} วัน`}`
                : "—"}
            </p>
          </div>

          {/* Right: open rate placeholder + delete */}
          <div className="flex shrink-0 items-center gap-2">
            <div className="text-right">
              <p className="text-xs font-semibold" style={{ color: "var(--color-success)" }}>
                —
              </p>
              <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                Open rate
              </p>
            </div>
            <button
              onClick={onDelete}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-red-50"
              style={{ color: "var(--color-danger)" }}
              aria-label="ลบ step"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Tags row */}
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: "var(--color-primary-light)",
              color: "var(--color-primary)",
              borderRadius: "var(--radius-badge)",
            }}
          >
            <Mail className="h-2.5 w-2.5" />
            อีเมล
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: isFirst ? "#F0FDF4" : "var(--color-subtle)",
              color: isFirst ? "var(--color-success)" : "var(--color-muted)",
              borderRadius: "var(--radius-badge)",
            }}
          >
            <Clock className="h-2.5 w-2.5" />
            {step.delay_days === 0 ? "ส่งทันที" : `หลัง ${step.delay_days} วัน`}
          </span>
          {step.condition && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
              style={{
                backgroundColor: "var(--color-subtle)",
                color: "var(--color-muted)",
                borderRadius: "var(--radius-badge)",
              }}
            >
              เงื่อนไข: {step.condition}
            </span>
          )}
          <span
            className="ml-auto text-xs font-medium"
            style={{ color: "var(--color-muted)" }}
          >
            Step {step.step_order}
          </span>
        </div>
      </div>
    </div>
  )
}

// Add step dashed button
function AddStepButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex items-center gap-4">
      {/* Dot to align with icon column */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed bg-white"
        style={{ borderColor: "var(--color-border)" }}
      >
        <Plus className="h-4 w-4" style={{ color: "var(--color-muted)" }} />
      </div>
      <button
        onClick={onClick}
        className="flex-1 rounded-xl border-2 border-dashed px-4 py-3 text-left text-sm font-medium transition-colors hover:border-primary hover:bg-primary-light/30"
        style={{
          borderColor: "var(--color-border)",
          color: "var(--color-muted)",
          borderRadius: "var(--radius-card)",
        }}
      >
        + เพิ่ม Step
      </button>
    </div>
  )
}

// Stat box
function StatBox({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string | number
  valueColor?: string
}) {
  return (
    <div
      className="rounded-xl border bg-white p-3 text-center"
      style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
    >
      <p
        className="text-lg font-bold leading-none"
        style={{ color: valueColor ?? "var(--color-ink)" }}
      >
        {value}
      </p>
      <p className="mt-1 text-xs leading-tight" style={{ color: "var(--color-muted)" }}>
        {label}
      </p>
    </div>
  )
}

// Toggle row
function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
          {label}
        </p>
        {description && (
          <p className="mt-0.5 text-xs" style={{ color: "var(--color-muted)" }}>
            {description}
          </p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  )
}

// ============================================================
// Main Page
// ============================================================

export default function SequenceBuilderPage() {
  const params = useParams()
  const router = useRouter()
  const workspaceId = params.workspaceId as string
  const sequenceId = params.sequenceId as string
  const isNew = sequenceId === "new"

  const [sequence, setSequence] = useState<SequenceDetail | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [enrollmentsTotal, setEnrollmentsTotal] = useState(0)
  const [enrollmentsPage, setEnrollmentsPage] = useState(1)
  const [enrollmentsTotalPages, setEnrollmentsTotalPages] = useState(1)

  const [loading, setLoading] = useState(!isNew)
  const [error, setError] = useState<string | null>(null)

  // New sequence form
  const [newName, setNewName] = useState("")
  const [creatingNew, setCreatingNew] = useState(false)

  // Add step dialog
  const [addStepOpen, setAddStepOpen] = useState(false)
  const [stepTemplateId, setStepTemplateId] = useState("")
  const [stepDelayDays, setStepDelayDays] = useState("0")
  const [addingStep, setAddingStep] = useState(false)

  // Delete step dialog
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null)
  const [deleteStepOpen, setDeleteStepOpen] = useState(false)
  const [deletingStep, setDeletingStep] = useState(false)

  // Settings state (placeholder — not yet connected to DB)
  const [stopOnReply, setStopOnReply] = useState(true)
  const [trackUnsubscribe, setTrackUnsubscribe] = useState(true)

  // ============================================================
  // Data fetching
  // ============================================================

  const fetchSequence = useCallback(async () => {
    if (isNew) return
    setLoading(true)
    setError(null)
    try {
      const [seqResult, tmplResult] = await Promise.all([
        trpc.sequence.getById.query({ workspaceId, sequenceId }),
        trpc.template.list.query({ workspaceId, pageSize: 100 }),
      ])
      setSequence(seqResult as unknown as SequenceDetail)
      setTemplates(tmplResult.templates as unknown as Template[])
    } catch {
      setError("ไม่พบ sequence นี้")
    } finally {
      setLoading(false)
    }
  }, [workspaceId, sequenceId, isNew])

  const fetchEnrollments = useCallback(async () => {
    if (isNew || !sequenceId) return
    try {
      const result = await trpc.sequence.getEnrollments.query({
        workspaceId,
        sequenceId,
        page: enrollmentsPage,
        pageSize: 10,
      })
      setEnrollments(result.enrollments as unknown as Enrollment[])
      setEnrollmentsTotal(result.total)
      setEnrollmentsTotalPages(result.totalPages)
    } catch {
      // silent
    }
  }, [workspaceId, sequenceId, enrollmentsPage, isNew])

  useEffect(() => { fetchSequence() }, [fetchSequence])
  useEffect(() => { fetchEnrollments() }, [fetchEnrollments])

  // Load templates for new sequence
  useEffect(() => {
    if (!isNew) return
    trpc.template.list.query({ workspaceId, pageSize: 100 }).then((r) => {
      setTemplates(r.templates as unknown as Template[])
    })
  }, [workspaceId, isNew])

  // ============================================================
  // Handlers
  // ============================================================

  const handleCreateNew = async () => {
    if (!newName.trim()) {
      toast.error("กรุณาใส่ชื่อ sequence")
      return
    }
    setCreatingNew(true)
    try {
      const created = await trpc.sequence.create.mutate({
        workspaceId,
        name: newName.trim(),
      })
      toast.success("สร้าง sequence แล้ว")
      router.replace(`/${workspaceId}/sequences/${created.id}`)
    } catch {
      toast.error("ไม่สามารถสร้าง sequence ได้")
    } finally {
      setCreatingNew(false)
    }
  }

  const handleAddStep = async () => {
    if (!stepTemplateId) {
      toast.error("กรุณาเลือก template")
      return
    }
    setAddingStep(true)
    try {
      await trpc.sequence.addStep.mutate({
        workspaceId,
        sequenceId,
        templateId: stepTemplateId,
        delayDays: parseInt(stepDelayDays) || 0,
      })
      toast.success("เพิ่ม step แล้ว")
      setAddStepOpen(false)
      setStepTemplateId("")
      setStepDelayDays("0")
      fetchSequence()
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถเพิ่ม step ได้"
      toast.error(msg)
    } finally {
      setAddingStep(false)
    }
  }

  const handleDeleteStep = async () => {
    if (!deletingStepId) return
    setDeletingStep(true)
    try {
      await trpc.sequence.removeStep.mutate({
        workspaceId,
        sequenceId,
        stepId: deletingStepId,
      })
      toast.success("ลบ step แล้ว")
      setDeleteStepOpen(false)
      setDeletingStepId(null)
      fetchSequence()
    } catch {
      toast.error("ไม่สามารถลบ step ได้")
    } finally {
      setDeletingStep(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!sequence) return
    const newStatus = sequence.status === "active" ? "paused" : "active"
    try {
      await trpc.sequence.update.mutate({
        workspaceId,
        sequenceId,
        status: newStatus,
      })
      toast.success(newStatus === "active" ? "เปิดใช้งาน sequence แล้ว" : "หยุด sequence แล้ว")
      fetchSequence()
    } catch {
      toast.error("ไม่สามารถเปลี่ยนสถานะได้")
    }
  }

  // ============================================================
  // New sequence form
  // ============================================================
  if (isNew) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "var(--color-canvas)" }}>
        <div className="mx-auto max-w-md px-8 py-8">
          <div className="mb-6 flex items-center gap-3">
            <Link href={`/${workspaceId}/sequences`}>
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                กลับ
              </Button>
            </Link>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
              สร้าง Sequence ใหม่
            </h1>
          </div>

          <div
            className="rounded-xl border bg-white p-6 shadow-sm"
            style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="seq-name" style={{ color: "var(--color-ink)" }}>
                  ชื่อ Sequence <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="seq-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="เช่น Cold Outreach — ร้านอาหาร 5 Steps"
                  style={{ borderRadius: "var(--radius-input)" }}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateNew()}
                />
              </div>

              <Button
                onClick={handleCreateNew}
                disabled={creatingNew || !newName.trim()}
                className="w-full"
                style={{
                  backgroundColor: "var(--color-primary)",
                  borderRadius: "var(--radius-btn)",
                }}
              >
                {creatingNew ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                สร้าง Sequence
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // Loading / Error states
  // ============================================================
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

  if (error || !sequence) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3"
        style={{ backgroundColor: "var(--color-canvas)" }}
      >
        <AlertTriangle className="h-8 w-8" style={{ color: "var(--color-danger)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
          {error ?? "ไม่พบ sequence"}
        </p>
        <Link href={`/${workspaceId}/sequences`}>
          <Button variant="outline" size="sm">
            กลับไปหน้า Sequences
          </Button>
        </Link>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[sequence.status]

  // ============================================================
  // Main UI
  // ============================================================
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-canvas)" }}>
      <div className="px-6 py-6 lg:px-8 lg:py-8">

        {/* ─── Header bar ──────────────────────────────────────── */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: breadcrumb + status */}
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href={`/${workspaceId}/sequences`}
              className="flex items-center gap-1 text-sm transition-colors hover:opacity-80"
              style={{ color: "var(--color-muted)" }}
            >
              ลำดับอีเมล
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-border)" }} />
            <span
              className="truncate text-sm font-semibold"
              style={{ color: "var(--color-ink)" }}
            >
              {sequence.name}
            </span>

            {/* Status badge */}
            <span
              className="ml-1 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{
                color: statusCfg.color,
                backgroundColor: statusCfg.bg,
                borderRadius: "var(--radius-badge)",
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: statusCfg.dot }}
              />
              {statusCfg.label}
            </span>
          </div>

          {/* Right: action buttons */}
          <div className="flex shrink-0 items-center gap-2">
            {sequence.status !== "archived" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleStatus}
                className="gap-1.5"
                style={{ borderRadius: "var(--radius-btn)" }}
              >
                {sequence.status === "active" ? (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    หยุด
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    เปิดใช้งาน
                  </>
                )}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setAddStepOpen(true)}
              className="gap-1.5"
              style={{
                backgroundColor: "var(--color-primary)",
                borderRadius: "var(--radius-btn)",
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              เพิ่ม Step
            </Button>
          </div>
        </div>

        {/* ─── 2-column layout ─────────────────────────────────── */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

          {/* ─── Center: Visual Timeline ──────────────────────── */}
          <div className="flex-1 min-w-0">
            <div
              className="rounded-2xl border bg-white shadow-sm"
              style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
            >
              {/* Panel header */}
              <div
                className="flex items-center gap-2 border-b px-5 py-4"
                style={{ borderColor: "var(--color-border)" }}
              >
                <BarChart3 className="h-4 w-4" style={{ color: "var(--color-primary)" }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                  Timeline ลำดับ
                </h2>
                <span
                  className="ml-auto rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: "var(--color-primary-light)",
                    color: "var(--color-primary)",
                  }}
                >
                  {sequence.steps.length} steps
                </span>
              </div>

              <div className="px-5 py-6">
                {/* ── Start node (always shown) ── */}
                <StartNode />

                {sequence.steps.length === 0 ? (
                  /* Empty state */
                  <>
                    <Connector />
                    <AddStepButton onClick={() => setAddStepOpen(true)} />
                    <div className="mt-10 flex flex-col items-center gap-2 py-6 text-center">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full"
                        style={{ backgroundColor: "var(--color-primary-light)" }}
                      >
                        <Mail className="h-6 w-6" style={{ color: "var(--color-primary)" }} />
                      </div>
                      <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                        ยังไม่มี steps
                      </p>
                      <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                        กด "+ เพิ่ม Step" ด้านบนเพื่อเริ่มสร้างลำดับอีเมล
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    {sequence.steps.map((step, idx) => (
                      <div key={step.id}>
                        {/* Connector before each email step (from start or previous step) */}
                        <Connector delayDays={step.delay_days} />

                        {/* Email step card */}
                        <EmailStepNode
                          step={step}
                          isFirst={idx === 0}
                          onDelete={() => {
                            setDeletingStepId(step.id)
                            setDeleteStepOpen(true)
                          }}
                        />
                      </div>
                    ))}

                    {/* Connector + Add step button at bottom */}
                    <Connector />
                    <AddStepButton onClick={() => setAddStepOpen(true)} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ─── Right Sidebar ────────────────────────────────── */}
          <div className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col gap-4">

            {/* Stats section */}
            <div
              className="rounded-2xl border bg-white shadow-sm"
              style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
            >
              <div
                className="flex items-center gap-2 border-b px-5 py-4"
                style={{ borderColor: "var(--color-border)" }}
              >
                <TrendingUp className="h-4 w-4" style={{ color: "var(--color-primary)" }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                  สถิติลำดับ
                </h2>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <StatBox
                    label="ผู้รับทั้งหมด"
                    value={enrollmentsTotal > 0 ? enrollmentsTotal : "—"}
                    valueColor="var(--color-ink)"
                  />
                  <StatBox
                    label="เปิดอ่าน"
                    value="—"
                    valueColor="var(--color-success)"
                  />
                  <StatBox
                    label="ตอบกลับ"
                    value="—"
                    valueColor="var(--color-primary)"
                  />
                  <StatBox
                    label="ยกเลิก"
                    value="—"
                    valueColor="var(--color-danger)"
                  />
                </div>
              </div>
            </div>

            {/* Settings section */}
            <div
              className="rounded-2xl border bg-white shadow-sm"
              style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
            >
              <div
                className="flex items-center gap-2 border-b px-5 py-4"
                style={{ borderColor: "var(--color-border)" }}
              >
                <Settings className="h-4 w-4" style={{ color: "var(--color-primary)" }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                  ตั้งค่า
                </h2>
              </div>

              <div className="space-y-4 p-4">
                {/* Sender name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
                    ชื่อผู้ส่ง
                  </Label>
                  <Input
                    defaultValue="Thanakrit — LeadFlow"
                    placeholder="ชื่อผู้ส่ง"
                    style={{ borderRadius: "var(--radius-input)", fontSize: "13px" }}
                  />
                </div>

                {/* Sender email */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
                    อีเมลผู้ส่ง
                  </Label>
                  <Input
                    defaultValue="thanakrit@leadflow.co"
                    placeholder="email@domain.com"
                    type="email"
                    style={{ borderRadius: "var(--radius-input)", fontSize: "13px" }}
                  />
                </div>

                {/* Send window */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
                    ช่วงเวลาส่ง
                  </Label>
                  <Input
                    defaultValue="จันทร์-ศุกร์ 09:00 - 17:00"
                    placeholder="กำหนดช่วงเวลาส่ง"
                    style={{ borderRadius: "var(--radius-input)", fontSize: "13px" }}
                  />
                </div>

                {/* Divider */}
                <div className="h-px" style={{ backgroundColor: "var(--color-border)" }} />

                {/* Toggles */}
                <div className="space-y-3">
                  <ToggleRow
                    label="หยุดเมื่อตอบกลับ"
                    description="หยุดส่งอีเมลถัดไปทันทีที่ลีดตอบ"
                    checked={stopOnReply}
                    onCheckedChange={setStopOnReply}
                  />
                  <ToggleRow
                    label="ติดตาม Unsubscribe"
                    description="แนบลิงก์ยกเลิกทุกอีเมล"
                    checked={trackUnsubscribe}
                    onCheckedChange={setTrackUnsubscribe}
                  />
                </div>
              </div>
            </div>

            {/* Enrollments section */}
            <div
              className="rounded-2xl border bg-white shadow-sm"
              style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
            >
              <div
                className="flex items-center justify-between border-b px-5 py-4"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" style={{ color: "var(--color-primary)" }} />
                  <h2 className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                    ผู้รับ
                  </h2>
                </div>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: "var(--color-primary-light)",
                    color: "var(--color-primary)",
                  }}
                >
                  {enrollmentsTotal}
                </span>
              </div>

              {enrollments.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8">
                  <Users className="h-8 w-8" style={{ color: "var(--color-border)" }} />
                  <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                    ยังไม่มีผู้รับ
                  </p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                  {enrollments.map((enroll) => (
                    <div key={enroll.id} className="px-4 py-3">
                      {enroll.leads ? (
                        <Link href={`/${workspaceId}/leads/${enroll.leads.id}`} className="block">
                          <p
                            className="truncate text-sm font-medium hover:underline"
                            style={{ color: "var(--color-ink)" }}
                          >
                            {enroll.leads.name}
                          </p>
                          <p className="truncate text-xs" style={{ color: "var(--color-muted)" }}>
                            {enroll.leads.email ?? "ไม่มีอีเมล"}
                          </p>
                        </Link>
                      ) : (
                        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                          —
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                          Step {enroll.current_step}
                        </span>
                        <span
                          className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: enroll.status === "active" ? "#F0FDF4" : "#F5F0EB",
                            color: enroll.status === "active" ? "#16A34A" : "#7A6F68",
                            borderRadius: "var(--radius-badge)",
                          }}
                        >
                          {enroll.status === "active" ? "กำลังส่ง" : enroll.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Enrollments pagination */}
              {enrollmentsTotalPages > 1 && (
                <div
                  className="flex items-center justify-center gap-2 border-t px-4 py-3"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={enrollmentsPage <= 1}
                    onClick={() => setEnrollmentsPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                    {enrollmentsPage} / {enrollmentsTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={enrollmentsPage >= enrollmentsTotalPages}
                    onClick={() => setEnrollmentsPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Add Step Dialog ─────────────────────────────────── */}
      <Dialog open={addStepOpen} onOpenChange={setAddStepOpen}>
        <DialogContent style={{ borderRadius: "var(--radius-modal)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--color-ink)" }}>เพิ่ม Step</DialogTitle>
            <DialogDescription style={{ color: "var(--color-muted)" }}>
              เลือก template และกำหนดระยะเวลาก่อนส่ง
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label style={{ color: "var(--color-ink)" }}>
                Email Template <span className="text-red-500">*</span>
              </Label>
              <Select value={stepTemplateId} onValueChange={setStepTemplateId}>
                <SelectTrigger style={{ borderRadius: "var(--radius-input)" }}>
                  <SelectValue placeholder="เลือก template" />
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
            </div>

            <div className="space-y-1.5">
              <Label style={{ color: "var(--color-ink)" }}>ส่งหลังจาก (วัน)</Label>
              <Input
                type="number"
                min={0}
                max={365}
                value={stepDelayDays}
                onChange={(e) => setStepDelayDays(e.target.value)}
                placeholder="0 = ส่งทันที"
                style={{ borderRadius: "var(--radius-input)" }}
              />
              <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                0 = ส่งทันทีหลัง enroll หรือหลัง step ก่อนหน้า
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddStepOpen(false)}
              disabled={addingStep}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleAddStep}
              disabled={addingStep || !stepTemplateId}
              style={{
                backgroundColor: "var(--color-primary)",
                borderRadius: "var(--radius-btn)",
              }}
            >
              {addingStep ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              เพิ่ม Step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Step Dialog ──────────────────────────────── */}
      <Dialog open={deleteStepOpen} onOpenChange={setDeleteStepOpen}>
        <DialogContent style={{ borderRadius: "var(--radius-modal)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--color-ink)" }}>ลบ Step</DialogTitle>
            <DialogDescription style={{ color: "var(--color-muted)" }}>
              คุณต้องการลบ step นี้ใช่หรือไม่? การลบไม่สามารถยกเลิกได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteStepOpen(false)}
              disabled={deletingStep}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleDeleteStep}
              disabled={deletingStep}
              style={{
                backgroundColor: "var(--color-danger)",
                borderRadius: "var(--radius-btn)",
              }}
            >
              {deletingStep ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              ลบ Step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
