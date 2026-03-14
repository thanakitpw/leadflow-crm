"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  GitBranch,
  AlertTriangle,
  Loader2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
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

interface Sequence {
  id: string
  name: string
  status: SequenceStatus
  created_at: string
  stepsCount: number
  activeEnrollments: number
}

interface ListResult {
  sequences: Sequence[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface Props {
  workspaceId: string
  canEdit: boolean
  initialPage?: number
}

// ============================================================
// Helpers
// ============================================================

const STATUS_CONFIG: Record<
  SequenceStatus,
  { label: string; color: string; bg: string }
> = {
  active: {
    label: "กำลังทำงาน",
    color: "var(--color-success)",
    bg: "#F0FDF4",
  },
  paused: {
    label: "หยุดชั่วคราว",
    color: "var(--color-warning)",
    bg: "#FEF3C7",
  },
  draft: {
    label: "ร่าง",
    color: "var(--color-muted)",
    bg: "var(--color-subtle)",
  },
  archived: {
    label: "เก็บถาวร",
    color: "var(--color-muted)",
    bg: "var(--color-subtle)",
  },
}

// ============================================================
// Sub-components
// ============================================================

function StatusBadge({ status }: { status: SequenceStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-xs font-medium"
      style={{
        color: cfg.color,
        backgroundColor: cfg.bg,
        borderRadius: "var(--radius-badge)",
      }}
    >
      {cfg.label}
    </span>
  )
}

function StatItem({
  label,
  value,
  highlight,
}: {
  label: string
  value: string | number
  highlight?: boolean
}) {
  return (
    <div className="flex flex-col items-end">
      <span
        className="text-xs"
        style={{ color: "var(--color-muted)", marginBottom: "2px" }}
      >
        {label}
      </span>
      <span
        className="text-sm font-semibold"
        style={{
          color: highlight ? "var(--color-success)" : "var(--color-ink)",
        }}
      >
        {value}
      </span>
    </div>
  )
}

function SequenceCard({
  seq,
  workspaceId,
  canEdit,
  onDelete,
}: {
  seq: Sequence
  workspaceId: string
  canEdit: boolean
  onDelete: (id: string) => void
}) {
  const stepsLabel =
    seq.stepsCount > 0 ? `${seq.stepsCount} ขั้นตอน` : "ยังไม่มีขั้นตอน"

  return (
    <div
      className="flex items-center justify-between gap-6 bg-white px-6 py-5 transition-colors hover:bg-slate-50/50"
      style={{
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      {/* Left — name + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href={`/${workspaceId}/sequences/${seq.id}`}
            className="text-base font-semibold hover:underline"
            style={{ color: "var(--color-ink)" }}
          >
            {seq.name}
          </Link>
          <StatusBadge status={seq.status} />
        </div>
        <p className="mt-1 text-sm truncate" style={{ color: "var(--color-muted)" }}>
          {stepsLabel}
          {seq.stepsCount > 0 && " · ส่งวันจันทร์–ศุกร์ 09:00"}
        </p>
      </div>

      {/* Right — stats + action */}
      <div className="flex items-center gap-6 shrink-0">
        <StatItem
          label="ผู้รับ"
          value={seq.activeEnrollments > 0 ? seq.activeEnrollments.toLocaleString("th-TH") : "—"}
        />
        <StatItem label="Open" value="—" />
        <StatItem label="Reply" value="—" />

        <div className="flex items-center gap-2 ml-2">
          <Link href={`/${workspaceId}/sequences/${seq.id}`}>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs font-medium"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-ink)",
                borderRadius: "var(--radius-btn)",
              }}
            >
              แก้ไข
            </Button>
          </Link>
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onDelete(seq.id)}
              style={{ color: "var(--color-muted)" }}
              title="ลบลำดับนี้"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function SequenceListClient({ workspaceId, canEdit, initialPage = 1 }: Props) {
  const [page, setPage] = useState(initialPage)
  const [data, setData] = useState<ListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchSequences = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await trpc.sequence.list.query({ workspaceId, page, pageSize: 20 })
      setData(result as ListResult)
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถดึงข้อมูลลำดับอีเมลได้"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [workspaceId, page])

  useEffect(() => {
    fetchSequences()
  }, [fetchSequences])

  const handleDeleteRequest = (id: string) => {
    setDeletingId(id)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setDeleteLoading(true)
    try {
      await trpc.sequence.delete.mutate({ workspaceId, sequenceId: deletingId })
      toast.success("ลบลำดับอีเมลแล้ว")
      setDeleteOpen(false)
      setDeletingId(null)
      fetchSequences()
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถลบลำดับอีเมลได้"
      toast.error(msg)
    } finally {
      setDeleteLoading(false)
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border bg-white py-24"
        style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
      >
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--color-primary)" }} />
      </div>
    )
  }

  // ── Error ──
  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-white py-24"
        style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
      >
        <AlertTriangle className="h-8 w-8" style={{ color: "var(--color-danger)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
          {error}
        </p>
        <Button variant="outline" size="sm" onClick={fetchSequences}>
          ลองใหม่อีกครั้ง
        </Button>
      </div>
    )
  }

  // ── Empty state ──
  if (!data || data.sequences.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 rounded-xl border bg-white py-24"
        style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--color-primary-light)" }}
        >
          <GitBranch className="h-7 w-7" style={{ color: "var(--color-primary)" }} />
        </div>
        <div className="text-center">
          <p className="font-semibold" style={{ color: "var(--color-ink)" }}>
            ยังไม่มีลำดับอีเมล
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
            สร้างลำดับเพื่อส่งอีเมลอัตโนมัติแบบหลายขั้นตอน
          </p>
        </div>
        {canEdit && (
          <Link href={`/${workspaceId}/sequences/new`}>
            <Button
              className="text-white"
              style={{
                backgroundColor: "var(--color-primary)",
                borderRadius: "var(--radius-btn)",
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              สร้างลำดับใหม่
            </Button>
          </Link>
        )}
      </div>
    )
  }

  // ── Sequence list ──
  return (
    <>
      <div
        className="overflow-hidden rounded-xl border bg-white shadow-sm"
        style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
      >
        {/* Column header bar */}
        <div
          className="flex items-center justify-between px-6 py-3"
          style={{
            borderBottom: "1px solid var(--color-border)",
            backgroundColor: "var(--color-canvas)",
          }}
        >
          <span className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
            ชื่อลำดับ / สถานะ
          </span>
          <div className="flex items-center gap-6 pr-24">
            <span className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
              ผู้รับ
            </span>
            <span className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
              Open
            </span>
            <span className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
              Reply
            </span>
          </div>
        </div>

        {/* Sequence rows */}
        <div>
          {data.sequences.map((seq) => (
            <SequenceCard
              key={seq.id}
              seq={seq}
              workspaceId={workspaceId}
              canEdit={canEdit}
              onDelete={handleDeleteRequest}
            />
          ))}
        </div>

        {/* Pagination */}
        {data.totalPages > 1 && (
          <div
            className="flex items-center justify-between px-6 py-3"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>
              {data.total} ลำดับทั้งหมด
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                style={{ borderRadius: "var(--radius-sm)", borderColor: "var(--color-border)" }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium" style={{ color: "var(--color-ink)" }}>
                {page} / {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{ borderRadius: "var(--radius-sm)", borderColor: "var(--color-border)" }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent style={{ borderRadius: "var(--radius-modal)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--color-ink)" }}>ยืนยันการลบลำดับอีเมล</DialogTitle>
            <DialogDescription style={{ color: "var(--color-muted)" }}>
              คุณต้องการลบลำดับนี้ใช่หรือไม่? ผู้รับที่อยู่ในระหว่างกระบวนการจะหยุดรับอีเมล
              การกระทำนี้ไม่สามารถยกเลิกได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteLoading}
              style={{ borderRadius: "var(--radius-btn)" }}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleteLoading}
              style={{
                backgroundColor: "var(--color-danger)",
                borderRadius: "var(--radius-btn)",
              }}
            >
              {deleteLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              ลบลำดับอีเมล
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
