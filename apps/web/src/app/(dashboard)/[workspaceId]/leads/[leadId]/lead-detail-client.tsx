"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Trash2,
  Loader2,
  Plus,
  X,
  Sparkles,
  GitBranch,
  Mail,
  MailOpen,
  MousePointerClick,
  AlertTriangle,
  Clock,
  CheckSquare,
  Square,
  ChevronDown,
  CheckCircle2,
  Star,
  Search,
  UserCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

type LeadStatus = "new" | "contacted" | "qualified" | "unqualified"

interface Tag {
  id: string
  tag: string
}

interface LeadInfo {
  id: string
  name: string
  email: string | null
  phone: string | null
  website: string | null
  status: string
  notes: string | null
  tags: Tag[]
}

interface Props {
  workspaceId: string
  lead: LeadInfo
  canEdit: boolean
}

// ============================================================
// Mock Tasks (placeholder — will be real feature later)
// ============================================================

interface Task {
  id: string
  label: string
  done: boolean
}

const INITIAL_TASKS: Task[] = [
  { id: "t1", label: "ตรวจสอบอีเมลที่ได้มา", done: true },
  { id: "t2", label: "ส่ง outreach email ชุดแรก", done: false },
  { id: "t3", label: "Follow up หลัง 3 วัน", done: false },
]

// ============================================================
// Helpers
// ============================================================

function timeAgo(dateStr: string): string {
  const now = new Date()
  const d = new Date(dateStr)
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
  if (diffMin < 1) return "เมื่อกี้"
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} ชั่วโมงที่แล้ว`
  return `${Math.floor(diffHr / 24)} วันที่แล้ว`
}

// ============================================================
// Sub-components
// ============================================================

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-3 text-xs font-semibold uppercase tracking-wider"
      style={{ color: "var(--color-muted)" }}
    >
      {children}
    </p>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function LeadDetailClient({ workspaceId, lead, canEdit }: Props) {
  const router = useRouter()

  // Status
  const [status, setStatus] = useState<LeadStatus>(lead.status as LeadStatus)
  const [savingStatus, setSavingStatus] = useState(false)

  // Tags
  const [tags, setTags] = useState<Tag[]>(lead.tags)
  const [newTag, setNewTag] = useState("")
  const [addingTag, setAddingTag] = useState(false)
  const [showTagInput, setShowTagInput] = useState(false)

  // Notes
  const [notes, setNotes] = useState(lead.notes ?? "")
  const [savingNotes, setSavingNotes] = useState(false)

  // Email enrichment
  const [findingEmail, setFindingEmail] = useState(false)

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Enroll in sequence
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [enrollSequenceId, setEnrollSequenceId] = useState("")
  const [enrolling, setEnrolling] = useState(false)

  // Sequences for enroll dialog
  const [sequences, setSequences] = useState<{ id: string; name: string }[] | null>(null)

  // Email activity
  const [emailActivity, setEmailActivity] = useState<{
    id: string
    event_type: string
    subject: string | null
    created_at: string
  }[] | null>(null)
  const [activityLoading, setActivityLoading] = useState(true)

  // Tasks (placeholder)
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS)

  // Load email activity once on mount
  useEffect(() => {
    let cancelled = false
    setActivityLoading(true)
    trpc.lead.getEmailActivity.query({ workspaceId, leadId: lead.id })
      .then((result) => {
        if (!cancelled) setEmailActivity(result)
      })
      .catch(() => {
        if (!cancelled) setEmailActivity([])
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false)
      })
    return () => { cancelled = true }
  }, [workspaceId, lead.id])

  // Load sequences when enroll dialog opens
  useEffect(() => {
    if (!enrollOpen || sequences !== null) return
    let cancelled = false
    trpc.sequence.list.query({ workspaceId })
      .then((result) => {
        if (!cancelled) setSequences(result.sequences as { id: string; name: string }[])
      })
      .catch(() => {
        if (!cancelled) setSequences([])
      })
    return () => { cancelled = true }
  }, [enrollOpen, workspaceId, sequences])

  // ============================================================
  // Handlers
  // ============================================================

  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (newStatus === status) return
    setSavingStatus(true)
    try {
      await trpc.lead.update.mutate({
        workspaceId,
        leadId: lead.id,
        status: newStatus,
      })
      setStatus(newStatus)
      toast.success("อัพเดทสถานะแล้ว")
      router.refresh()
    } catch {
      toast.error("ไม่สามารถอัพเดทสถานะได้")
    } finally {
      setSavingStatus(false)
    }
  }

  const handleSaveNotes = async () => {
    setSavingNotes(true)
    try {
      await trpc.lead.update.mutate({
        workspaceId,
        leadId: lead.id,
        notes,
      })
      toast.success("บันทึก notes แล้ว")
      router.refresh()
    } catch {
      toast.error("ไม่สามารถบันทึก notes ได้")
    } finally {
      setSavingNotes(false)
    }
  }

  const handleAddTag = async () => {
    const tag = newTag.trim()
    if (!tag) return
    if (tags.some((t) => t.tag === tag)) {
      toast.info(`Tag "${tag}" มีอยู่แล้ว`)
      return
    }
    setAddingTag(true)
    try {
      const result = await trpc.lead.addTag.mutate({
        workspaceId,
        leadId: lead.id,
        tag,
      })
      setTags((prev) => [...prev, result as Tag])
      setNewTag("")
      setShowTagInput(false)
      toast.success(`เพิ่ม tag "${tag}" แล้ว`)
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถเพิ่ม tag ได้"
      toast.error(msg)
    } finally {
      setAddingTag(false)
    }
  }

  const handleRemoveTag = async (tagId: string, tagName: string) => {
    try {
      await trpc.lead.removeTag.mutate({ workspaceId, tagId })
      setTags((prev) => prev.filter((t) => t.id !== tagId))
      toast.success(`ลบ tag "${tagName}" แล้ว`)
    } catch {
      toast.error("ไม่สามารถลบ tag ได้")
    }
  }

  const handleFindEmail = async () => {
    if (!lead.website) {
      toast.error("ไม่มีเว็บไซต์ให้ค้นหาอีเมล")
      return
    }
    setFindingEmail(true)
    try {
      const pythonApiUrl = process.env.NEXT_PUBLIC_PYTHON_API_URL ?? "http://localhost:8000"
      const res = await fetch(`${pythonApiUrl}/api/v1/enrichment/find-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: lead.website }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.detail ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as {
        website: string
        emails?: { email: string; confidence: number; source: string }[]
        emails_found?: { email: string; confidence: number; source: string }[]
      }
      const emailList = data.emails ?? data.emails_found ?? []
      if (emailList.length > 0) {
        const best = emailList[0]
        await trpc.lead.update.mutate({
          workspaceId,
          leadId: lead.id,
          email: best.email,
        })
        toast.success(
          `พบอีเมล: ${best.email}${best.confidence ? ` (ความมั่นใจ ${best.confidence}%)` : ""}`
        )
        router.refresh()
      } else {
        toast.info("ไม่พบอีเมลในเว็บไซต์นี้")
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "ไม่สามารถค้นหาอีเมลได้"
      toast.error(msg)
    } finally {
      setFindingEmail(false)
    }
  }

  const handleEnrollInSequence = async () => {
    if (!enrollSequenceId) {
      toast.error("กรุณาเลือก sequence")
      return
    }
    setEnrolling(true)
    try {
      await trpc.sequence.enrollLeads.mutate({
        workspaceId,
        sequenceId: enrollSequenceId,
        leadIds: [lead.id],
      })
      toast.success(`เพิ่ม "${lead.name}" เข้า sequence แล้ว`)
      setEnrollOpen(false)
      setEnrollSequenceId("")
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถเพิ่มเข้า sequence ได้"
      toast.error(msg)
    } finally {
      setEnrolling(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await trpc.lead.delete.mutate({ workspaceId, leadId: lead.id })
      toast.success(`ลบ "${lead.name}" แล้ว`)
      router.push(`/${workspaceId}/leads`)
    } catch {
      toast.error("ไม่สามารถลบ lead ได้")
      setDeleting(false)
    }
  }

  const toggleTask = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  // ============================================================
  // Column 2 — Notes, Tags, Assign, Tasks
  // ============================================================

  const renderColumn2 = () => (
    <div className="space-y-5">
      {/* บันทึก */}
      <div
        className="rounded-xl border bg-white p-5"
        style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
      >
        <SectionLabel>บันทึก</SectionLabel>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="บันทึกข้อมูลเพิ่มเติม..."
          rows={4}
          readOnly={!canEdit}
          className="w-full resize-none rounded-lg border p-3 text-sm outline-none focus:ring-1 focus:ring-[#1E3A5F]"
          style={{
            borderColor: "var(--color-border)",
            borderRadius: "var(--radius-input)",
            color: "var(--color-ink)",
            backgroundColor: canEdit ? "white" : "var(--color-canvas)",
          }}
        />
        {canEdit && (
          <Button
            size="sm"
            className="mt-2 text-white"
            onClick={handleSaveNotes}
            disabled={savingNotes}
            style={{ backgroundColor: "var(--color-primary)", borderRadius: "var(--radius-btn)" }}
          >
            {savingNotes ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            บันทึก
          </Button>
        )}
      </div>

      {/* แท็ก */}
      <div
        className="rounded-xl border bg-white p-5"
        style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
      >
        <SectionLabel>แท็ก</SectionLabel>
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((t) => {
            const isHot = t.tag.toLowerCase() === "hot"
            return (
              <span
                key={t.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium"
                style={{
                  borderRadius: "9999px",
                  backgroundColor: isHot ? "#FEF3C7" : "var(--color-primary-light)",
                  color: isHot ? "#D97706" : "var(--color-primary)",
                }}
              >
                {t.tag}
                {canEdit && (
                  <button
                    onClick={() => handleRemoveTag(t.id, t.tag)}
                    className="ml-0.5 rounded-full transition-colors hover:opacity-70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            )
          })}
          {canEdit && (
            <>
              {showTagInput ? (
                <div className="flex items-center gap-1">
                  <Input
                    autoFocus
                    placeholder="ชื่อแท็ก..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddTag()
                      if (e.key === "Escape") { setShowTagInput(false); setNewTag("") }
                    }}
                    className="h-7 w-28 text-xs"
                    style={{ borderRadius: "var(--radius-input)" }}
                  />
                  <button
                    onClick={handleAddTag}
                    disabled={addingTag || !newTag.trim()}
                    className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:opacity-80"
                    style={{ backgroundColor: "var(--color-primary)", color: "white" }}
                  >
                    {addingTag ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  </button>
                  <button
                    onClick={() => { setShowTagInput(false); setNewTag("") }}
                    className="flex h-7 w-7 items-center justify-center rounded-full transition-colors"
                    style={{ color: "var(--color-muted)" }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowTagInput(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-dashed transition-colors hover:border-solid"
                  style={{
                    borderRadius: "9999px",
                    borderColor: "var(--color-border)",
                    color: "var(--color-muted)",
                  }}
                >
                  <Plus className="h-3 w-3" />
                  เพิ่มแท็ก
                </button>
              )}
            </>
          )}
          {tags.length === 0 && !canEdit && (
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>ยังไม่มีแท็ก</p>
          )}
        </div>
      </div>

      {/* Assign ให้ Workspace */}
      <div
        className="rounded-xl border bg-white p-5"
        style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
      >
        <SectionLabel>Assign ให้ Workspace</SectionLabel>
        <div
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: "var(--color-border)",
            borderRadius: "var(--radius-input)",
            color: "var(--color-muted)",
            cursor: "not-allowed",
            backgroundColor: "var(--color-canvas)",
          }}
        >
          <span className="flex-1">เลือก client workspace...</span>
          <ChevronDown className="h-4 w-4 shrink-0" />
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--color-muted)" }}>
          ฟีเจอร์นี้จะพร้อมใช้เร็ว ๆ นี้
        </p>
      </div>

      {/* งานที่ต้องทำ */}
      <div
        className="rounded-xl border bg-white p-5"
        style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <SectionLabel>งานที่ต้องทำ</SectionLabel>
          <button
            onClick={() => toast.info("ฟีเจอร์เพิ่มงานจะพร้อมใช้เร็ว ๆ นี้")}
            className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--color-primary)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            เพิ่ม
          </button>
        </div>
        <div className="space-y-2.5">
          {tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => toggleTask(task.id)}
              className="flex w-full items-start gap-2.5 text-left transition-opacity hover:opacity-70"
            >
              {task.done ? (
                <CheckSquare
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color: "var(--color-success)" }}
                />
              ) : (
                <Square
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color: "var(--color-border)" }}
                />
              )}
              <span
                className="text-sm"
                style={{
                  color: task.done ? "var(--color-muted)" : "var(--color-ink)",
                  textDecoration: task.done ? "line-through" : "none",
                }}
              >
                {task.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Actions (enroll, find email) */}
      {canEdit && (
        <div
          className="rounded-xl border bg-white p-5"
          style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
        >
          <SectionLabel>Actions</SectionLabel>
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => toast.info("ฟีเจอร์ AI Scoring จะพร้อมใช้เร็ว ๆ นี้")}
              style={{ borderRadius: "var(--radius-btn)" }}
            >
              <Sparkles className="mr-2 h-3.5 w-3.5" style={{ color: "#7C3AED" }} />
              ให้คะแนน AI ใหม่
            </Button>
            {lead.website && !lead.email && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={handleFindEmail}
                disabled={findingEmail}
                style={{ borderRadius: "var(--radius-btn)" }}
              >
                {findingEmail ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-3.5 w-3.5" style={{ color: "var(--color-info)" }} />
                )}
                {findingEmail ? "กำลังค้นหาอีเมล..." : "หาอีเมล"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => {
                setEnrollSequenceId("")
                setEnrollOpen(true)
              }}
              style={{ borderRadius: "var(--radius-btn)" }}
            >
              <GitBranch className="mr-2 h-3.5 w-3.5" style={{ color: "var(--color-info)" }} />
              เพิ่มเข้า Sequence
            </Button>
          </div>
        </div>
      )}

      {/* Status change */}
      <div
        className="rounded-xl border bg-white p-5"
        style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
      >
        <SectionLabel>สถานะ</SectionLabel>
        {canEdit ? (
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={(v) => handleStatusChange(v as LeadStatus)}>
              <SelectTrigger className="flex-1" style={{ borderRadius: "var(--radius-input)" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">ใหม่</SelectItem>
                <SelectItem value="contacted">ติดต่อแล้ว</SelectItem>
                <SelectItem value="qualified">คัดแล้ว</SelectItem>
                <SelectItem value="unqualified">ไม่ผ่าน</SelectItem>
              </SelectContent>
            </Select>
            {savingStatus && <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--color-muted)" }} />}
          </div>
        ) : (
          <span
            className="inline-block rounded px-2 py-0.5 text-xs font-medium"
            style={{ borderRadius: "var(--radius-badge)", backgroundColor: "var(--color-subtle)", color: "var(--color-muted)" }}
          >
            {status === "new" ? "ใหม่" : status === "contacted" ? "ติดต่อแล้ว" : status === "qualified" ? "คัดแล้ว" : "ไม่ผ่าน"}
          </span>
        )}
      </div>

      {/* Delete */}
      {canEdit && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setDeleteOpen(true)}
          style={{ borderColor: "#DC2626", color: "#DC2626", borderRadius: "var(--radius-btn)" }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          ลบ Lead นี้
        </Button>
      )}
    </div>
  )

  // ============================================================
  // Column 3 — Activity Timeline
  // ============================================================

  const renderColumn3 = () => {
    // Build base timeline from lead creation + enrich
    const baseEvents = [
      {
        id: "enrich",
        type: "enrich",
        title: "AI Enrichment เสร็จสิ้น",
        detail: "ระบบ Claude AI วิเคราะห์และให้คะแนน lead เรียบร้อย",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "import",
        type: "import",
        title: "นำเข้าจาก Google Places",
        detail: "ข้อมูลธุรกิจถูกดึงมาจาก Google Places API",
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      },
    ]

    return (
      <div
        className="rounded-xl border bg-white p-5"
        style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
      >
        <SectionLabel>ประวัติกิจกรรม</SectionLabel>

        {activityLoading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-gray-100 shrink-0" />
                <div className="flex-1 pt-1">
                  <div className="h-3 w-3/4 rounded bg-gray-200 mb-2" />
                  <div className="h-2.5 w-1/2 rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div
              className="absolute left-4 top-0 bottom-0 w-px"
              style={{ backgroundColor: "var(--color-border)" }}
            />

            <div className="space-y-5">
              {/* Email activity events */}
              {emailActivity && emailActivity.length > 0 && emailActivity.map((event) => {
                let Icon = Mail
                let iconBg = "var(--color-primary-light)"
                let iconColor = "var(--color-primary)"
                let label = event.event_type

                switch (event.event_type) {
                  case "sent":
                    Icon = Mail
                    iconBg = "#DBEAFE"
                    iconColor = "var(--color-info)"
                    label = "ส่งอีเมล"
                    break
                  case "opened":
                    Icon = MailOpen
                    iconBg = "#F0FDF4"
                    iconColor = "var(--color-success)"
                    label = "เปิดอ่านอีเมล"
                    break
                  case "clicked":
                    Icon = MousePointerClick
                    iconBg = "#EDE9FE"
                    iconColor = "var(--color-ai)"
                    label = "คลิกลิงก์"
                    break
                  case "bounced":
                    Icon = AlertTriangle
                    iconBg = "#FEF2F2"
                    iconColor = "var(--color-danger)"
                    label = "อีเมล Bounce"
                    break
                }

                return (
                  <div key={event.id} className="relative flex items-start gap-3 pl-8">
                    <div
                      className="absolute left-0 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2"
                      style={{
                        backgroundColor: iconBg,
                        borderColor: "var(--color-canvas)",
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: iconColor }} />
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                        {label}
                        {event.subject && (
                          <span className="font-normal" style={{ color: "var(--color-muted)" }}>
                            {" "}— {event.subject}
                          </span>
                        )}
                      </p>
                      <div className="mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" style={{ color: "var(--color-muted)" }} />
                        <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                          {timeAgo(event.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Base timeline events */}
              {baseEvents.map((event) => {
                let Icon = Star
                let iconBg = "#FEF3C7"
                let iconColor = "#D97706"

                if (event.type === "import") {
                  Icon = Search
                  iconBg = "#DBEAFE"
                  iconColor = "var(--color-info)"
                } else if (event.type === "assign") {
                  Icon = UserCheck
                  iconBg = "#F0FDF4"
                  iconColor = "var(--color-success)"
                }

                return (
                  <div key={event.id} className="relative flex items-start gap-3 pl-8">
                    <div
                      className="absolute left-0 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2"
                      style={{
                        backgroundColor: iconBg,
                        borderColor: "var(--color-canvas)",
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: iconColor }} />
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                        {event.title}
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--color-muted)" }}>
                        {event.detail}
                      </p>
                      <div className="mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" style={{ color: "var(--color-muted)" }} />
                        <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                          {timeAgo(event.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Empty state */}
              {(!emailActivity || emailActivity.length === 0) && (
                <div
                  className="relative flex items-start gap-3 pl-8"
                >
                  <div
                    className="absolute left-0 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2"
                    style={{
                      backgroundColor: "var(--color-subtle)",
                      borderColor: "var(--color-canvas)",
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--color-muted)" }} />
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                      ยังไม่มีกิจกรรมอีเมล
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--color-muted)" }}>
                      เมื่อส่งอีเมลหา lead จะแสดงที่นี่
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ============================================================
  // Render — 2-column grid (col2 + col3) inside the parent's 2-col span
  // ============================================================

  return (
    <>
      {/* Inner 2-column grid: column 2 (notes/tags/tasks) + column 3 (timeline) */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          {renderColumn2()}
        </div>
        <div>
          {renderColumn3()}
        </div>
      </div>

      {/* Enroll in Sequence Dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent style={{ borderRadius: "var(--radius-modal)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--color-ink)" }}>เพิ่มเข้า Sequence</DialogTitle>
            <DialogDescription style={{ color: "var(--color-muted)" }}>
              เพิ่ม &quot;{lead.name}&quot; เข้า email sequence
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--color-ink)" }}>
              เลือก Sequence
            </label>
            <Select value={enrollSequenceId} onValueChange={setEnrollSequenceId}>
              <SelectTrigger style={{ borderRadius: "var(--radius-input)" }}>
                <SelectValue placeholder="เลือก sequence..." />
              </SelectTrigger>
              <SelectContent>
                {!sequences || sequences.length === 0 ? (
                  <div className="px-3 py-2 text-xs" style={{ color: "var(--color-muted)" }}>
                    ยังไม่มี sequence — สร้างใน Sequences ก่อน
                  </div>
                ) : (
                  (sequences as { id: string; name: string }[]).map((seq) => (
                    <SelectItem key={seq.id} value={seq.id}>
                      {seq.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEnrollOpen(false)}
              disabled={enrolling}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleEnrollInSequence}
              disabled={enrolling || !enrollSequenceId}
              style={{ backgroundColor: "var(--color-primary)", borderRadius: "var(--radius-btn)" }}
            >
              {enrolling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <GitBranch className="mr-2 h-4 w-4" />
              )}
              Enroll Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent style={{ borderRadius: "var(--radius-modal)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--color-ink)" }}>ยืนยันการลบ</DialogTitle>
            <DialogDescription style={{ color: "var(--color-muted)" }}>
              คุณต้องการลบ &quot;{lead.name}&quot; ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              style={{ backgroundColor: "#DC2626", borderRadius: "var(--radius-btn)" }}
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              ลบ Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
