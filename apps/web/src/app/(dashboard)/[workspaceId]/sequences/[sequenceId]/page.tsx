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

const STATUS_CONFIG: Record<SequenceStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "#7A6F68", bg: "#F5F0EB" },
  active: { label: "Active", color: "#16A34A", bg: "#F0FDF4" },
  paused: { label: "หยุดชั่วคราว", color: "#D97706", bg: "#FEF3C7" },
  archived: { label: "Archived", color: "#7A6F68", bg: "#F5F0EB" },
}

// ============================================================
// Component
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

  useEffect(() => {
    fetchSequence()
  }, [fetchSequence])

  useEffect(() => {
    fetchEnrollments()
  }, [fetchEnrollments])

  // Load templates สำหรับ new sequence
  useEffect(() => {
    if (!isNew) return
    trpc.template.list.query({ workspaceId, pageSize: 100 }).then((r) => {
      setTemplates(r.templates as unknown as Template[])
    })
  }, [workspaceId, isNew])

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

  // =========================================================
  // New sequence form
  // =========================================================
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
            className="rounded-xl border bg-white p-6"
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-canvas)" }}>
      <div className="px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/${workspaceId}/sequences`}>
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                กลับ
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
                  {sequence.name}
                </h1>
                <span
                  className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
                  style={{
                    color: statusCfg.color,
                    backgroundColor: statusCfg.bg,
                    borderRadius: "var(--radius-badge)",
                  }}
                >
                  {statusCfg.label}
                </span>
              </div>
              <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
                {sequence.steps.length} steps — {sequence.activeEnrollments} active enrollments
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sequence.status !== "archived" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleStatus}
                className="gap-2"
                style={{ borderRadius: "var(--radius-btn)" }}
              >
                {sequence.status === "active" ? (
                  <>
                    <Pause className="h-4 w-4" />
                    หยุด
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    เปิดใช้งาน
                  </>
                )}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setAddStepOpen(true)}
              className="gap-2"
              style={{
                backgroundColor: "var(--color-primary)",
                borderRadius: "var(--radius-btn)",
              }}
            >
              <Plus className="h-4 w-4" />
              เพิ่ม Step
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Step Builder — 2/3 */}
          <div className="col-span-2">
            <div
              className="rounded-xl border bg-white shadow-sm"
              style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
            >
              <div
                className="border-b px-5 py-4"
                style={{ borderColor: "var(--color-border)" }}
              >
                <h2 className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                  Sequence Steps
                </h2>
              </div>

              {sequence.steps.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: "var(--color-primary-light)" }}
                  >
                    <Mail className="h-6 w-6" style={{ color: "var(--color-primary)" }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                    ยังไม่มี steps
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setAddStepOpen(true)}
                    style={{
                      backgroundColor: "var(--color-primary)",
                      borderRadius: "var(--radius-btn)",
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    เพิ่ม Step แรก
                  </Button>
                </div>
              ) : (
                <div className="px-5 py-4">
                  {sequence.steps.map((step, idx) => (
                    <div key={step.id} className="relative">
                      {/* Connector line */}
                      {idx < sequence.steps.length - 1 && (
                        <div
                          className="absolute left-5 top-14 h-8 w-0.5"
                          style={{ backgroundColor: "var(--color-border)" }}
                        />
                      )}

                      <div className="mb-2 flex items-start gap-4">
                        {/* Step number */}
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                          style={{ backgroundColor: "var(--color-primary)" }}
                        >
                          {step.step_order}
                        </div>

                        {/* Step card */}
                        <div
                          className="flex-1 rounded-lg border p-4"
                          style={{
                            borderColor: "var(--color-border)",
                            borderRadius: "var(--radius-card)",
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p
                                className="text-sm font-semibold"
                                style={{ color: "var(--color-ink)" }}
                              >
                                {step.email_templates?.name ?? "ไม่มี template"}
                              </p>
                              <p className="mt-0.5 text-xs" style={{ color: "var(--color-muted)" }}>
                                {step.email_templates?.subject ?? "—"}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                setDeletingStepId(step.id)
                                setDeleteStepOpen(true)
                              }}
                              style={{ color: "var(--color-danger)" }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <div className="mt-3 flex items-center gap-3">
                            <div
                              className="flex items-center gap-1 rounded px-2 py-0.5 text-xs"
                              style={{
                                backgroundColor: "var(--color-primary-light)",
                                color: "var(--color-primary)",
                                borderRadius: "var(--radius-badge)",
                              }}
                            >
                              <Clock className="h-3 w-3" />
                              {step.delay_days === 0
                                ? "ส่งทันที"
                                : `หลังจาก ${step.delay_days} วัน`}
                            </div>
                            {step.condition && (
                              <span
                                className="text-xs"
                                style={{ color: "var(--color-muted)" }}
                              >
                                เงื่อนไข: {step.condition}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddStepOpen(true)}
                    className="mt-3 w-full gap-2 border-dashed"
                    style={{ borderRadius: "var(--radius-btn)" }}
                  >
                    <Plus className="h-4 w-4" />
                    เพิ่ม Step
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Enrollments — 1/3 */}
          <div>
            <div
              className="rounded-xl border bg-white shadow-sm"
              style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
            >
              <div
                className="flex items-center justify-between border-b px-5 py-4"
                style={{ borderColor: "var(--color-border)" }}
              >
                <h2 className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                  Enrollments
                </h2>
                <div
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: "var(--color-primary-light)",
                    color: "var(--color-primary)",
                  }}
                >
                  <Users className="h-3 w-3" />
                  {enrollmentsTotal}
                </div>
              </div>

              {enrollments.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8">
                  <Users className="h-8 w-8" style={{ color: "var(--color-muted)" }} />
                  <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                    ยังไม่มี enrollments
                  </p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                  {enrollments.map((enroll) => (
                    <div key={enroll.id} className="px-4 py-3">
                      {enroll.leads ? (
                        <Link
                          href={`/${workspaceId}/leads/${enroll.leads.id}`}
                          className="block"
                        >
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
                      <div className="mt-1 flex items-center justify-between">
                        <span
                          className="text-xs"
                          style={{ color: "var(--color-muted)" }}
                        >
                          Step {enroll.current_step}
                        </span>
                        <span
                          className="inline-flex rounded px-1.5 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor:
                              enroll.status === "active" ? "#F0FDF4" : "#F5F0EB",
                            color:
                              enroll.status === "active" ? "#16A34A" : "#7A6F68",
                            borderRadius: "var(--radius-badge)",
                          }}
                        >
                          {enroll.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Enrollments Pagination */}
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
                    {enrollmentsPage}/{enrollmentsTotalPages}
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

      {/* Add Step Dialog */}
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

      {/* Delete Step Dialog */}
      <Dialog open={deleteStepOpen} onOpenChange={setDeleteStepOpen}>
        <DialogContent style={{ borderRadius: "var(--radius-modal)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--color-ink)" }}>ลบ Step</DialogTitle>
            <DialogDescription style={{ color: "var(--color-muted)" }}>
              คุณต้องการลบ step นี้ใช่หรือไม่?
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
              style={{ backgroundColor: "var(--color-danger)", borderRadius: "var(--radius-btn)" }}
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
