"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Trash2,
  Loader2,
  Plus,
  X,
  Sparkles,
  Search,
  GitBranch,
  Mail,
  MailOpen,
  MousePointerClick,
  AlertTriangle,
  Clock,
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
// Component
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
        body: JSON.stringify({ website: lead.website, lead_id: lead.id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.detail ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      if (data.email) {
        await trpc.lead.update.mutate({
          workspaceId,
          leadId: lead.id,
          email: data.email,
        })
        toast.success(`พบอีเมล: ${data.email}`)
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

  // ============================================================
  // Render
  // ============================================================

  return (
    <>
      {/* Status Card */}
      <div
        className="rounded-xl border bg-white p-5"
        style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
          สถานะ
        </h2>
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
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            {status === "new"
              ? "ใหม่"
              : status === "contacted"
              ? "ติดต่อแล้ว"
              : status === "qualified"
              ? "คัดแล้ว"
              : "ไม่ผ่าน"}
          </p>
        )}
      </div>

      {/* Actions Card */}
      {canEdit && (
        <div
          className="rounded-xl border bg-white p-5"
          style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
        >
          <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
            Actions
          </h2>
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => toast.info("ฟีเจอร์ AI Scoring จะพร้อมใช้เร็วๆ นี้")}
              style={{ borderRadius: "var(--radius-btn)" }}
            >
              <Sparkles className="mr-2 h-3.5 w-3.5" style={{ color: "#7C3AED" }} />
              ให้คะแนน AI ใหม่
            </Button>
            {lead.website && (
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
                  <Search className="mr-2 h-3.5 w-3.5" />
                )}
                {findingEmail ? "กำลังค้นหา..." : "หาอีเมลจากเว็บ"}
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
              Enroll in Sequence
            </Button>
          </div>
        </div>
      )}

      {/* Tags Card */}
      <div
        className="rounded-xl border bg-white p-5"
        style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
          Tags
        </h2>

        {/* Tag list */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {tags.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
              ยังไม่มี tags
            </p>
          ) : (
            tags.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                style={{
                  backgroundColor: "var(--color-primary-light)",
                  color: "var(--color-primary)",
                  borderRadius: "9999px",
                }}
              >
                {t.tag}
                {canEdit && (
                  <button
                    onClick={() => handleRemoveTag(t.id, t.tag)}
                    className="ml-0.5 rounded-full transition-colors hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))
          )}
        </div>

        {/* Add tag */}
        {canEdit && (
          <div className="flex gap-2">
            <Input
              placeholder="เพิ่ม tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
              className="h-8 text-xs flex-1"
              style={{ borderRadius: "var(--radius-input)" }}
            />
            <Button
              size="sm"
              className="h-8"
              onClick={handleAddTag}
              disabled={addingTag || !newTag.trim()}
              style={{ backgroundColor: "var(--color-primary)", borderRadius: "var(--radius-btn)" }}
            >
              {addingTag ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          </div>
        )}
      </div>

      {/* Notes Card */}
      {canEdit && (
        <div
          className="rounded-xl border bg-white p-5"
          style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
        >
          <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
            Notes
          </h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="บันทึกข้อมูลเพิ่มเติม..."
            rows={4}
            className="w-full resize-none rounded-lg border p-3 text-sm outline-none focus:ring-1"
            style={{
              borderColor: "var(--color-border)",
              borderRadius: "var(--radius-input)",
              color: "var(--color-ink)",
              backgroundColor: "white",
            }}
          />
          <Button
            size="sm"
            className="mt-2"
            onClick={handleSaveNotes}
            disabled={savingNotes}
            style={{ backgroundColor: "var(--color-primary)", borderRadius: "var(--radius-btn)" }}
          >
            {savingNotes ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            บันทึก Notes
          </Button>
        </div>
      )}

      {/* Email Activity Card */}
      <div
        className="rounded-xl border bg-white p-5"
        style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
          Email Activity
        </h2>

        {activityLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-gray-100 shrink-0" />
                <div className="flex-1">
                  <div className="h-3 w-3/4 rounded bg-gray-200 mb-1" />
                  <div className="h-2.5 w-20 rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        ) : !emailActivity || (emailActivity as unknown[]).length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <Mail className="h-6 w-6" style={{ color: "var(--color-border)" }} />
            <p className="text-xs text-center" style={{ color: "var(--color-muted)" }}>
              ยังไม่มีกิจกรรมอีเมล
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {(emailActivity as {
              id: string
              event_type: string
              subject: string | null
              created_at: string
            }[]).map((event) => {
              let Icon = Mail
              let iconColor = "var(--color-muted)"
              let iconBg = "var(--color-subtle)"
              let label = event.event_type

              switch (event.event_type) {
                case "sent":
                  Icon = Mail
                  iconColor = "var(--color-primary)"
                  iconBg = "var(--color-primary-light)"
                  label = "ส่งอีเมล"
                  break
                case "opened":
                  Icon = MailOpen
                  iconColor = "var(--color-success)"
                  iconBg = "#F0FDF4"
                  label = "เปิดอ่านอีเมล"
                  break
                case "clicked":
                  Icon = MousePointerClick
                  iconColor = "var(--color-info)"
                  iconBg = "#DBEAFE"
                  label = "คลิกลิงก์"
                  break
                case "bounced":
                  Icon = AlertTriangle
                  iconColor = "var(--color-danger)"
                  iconBg = "#FEF2F2"
                  label = "อีเมล Bounce"
                  break
              }

              const timeAgo = (() => {
                const now = new Date()
                const d = new Date(event.created_at)
                const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
                if (diffMin < 1) return "เมื่อกี้"
                if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`
                const diffHr = Math.floor(diffMin / 60)
                if (diffHr < 24) return `${diffHr} ชั่วโมงที่แล้ว`
                return `${Math.floor(diffHr / 24)} วันที่แล้ว`
              })()

              return (
                <div key={event.id} className="flex items-start gap-2.5">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: iconBg }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: iconColor }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium" style={{ color: "var(--color-ink)" }}>
                      {label}
                      {event.subject && (
                        <span className="ml-1 font-normal" style={{ color: "var(--color-muted)" }}>
                          — {event.subject}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" style={{ color: "var(--color-muted)" }} />
                      <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                        {timeAgo}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
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

      {/* Enroll in Sequence Dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent style={{ borderRadius: "var(--radius-modal)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--color-ink)" }}>Enroll in Sequence</DialogTitle>
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
