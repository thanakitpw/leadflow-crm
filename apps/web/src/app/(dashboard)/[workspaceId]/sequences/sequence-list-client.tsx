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
  Users,
  Edit,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

const STATUS_CONFIG: Record<SequenceStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "#7A6F68", bg: "#F5F0EB" },
  active: { label: "Active", color: "#16A34A", bg: "#F0FDF4" },
  paused: { label: "หยุดชั่วคราว", color: "#D97706", bg: "#FEF3C7" },
  archived: { label: "Archived", color: "#7A6F68", bg: "#F5F0EB" },
}

// ============================================================
// Component
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
          : "ไม่สามารถดึงข้อมูล sequences ได้"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [workspaceId, page])

  useEffect(() => {
    fetchSequences()
  }, [fetchSequences])

  const handleDelete = async () => {
    if (!deletingId) return
    setDeleteLoading(true)
    try {
      await trpc.sequence.delete.mutate({ workspaceId, sequenceId: deletingId })
      toast.success("ลบ sequence แล้ว")
      setDeleteOpen(false)
      setDeletingId(null)
      fetchSequences()
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถลบ sequence ได้"
      toast.error(msg)
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div
      className="rounded-xl border bg-white shadow-sm"
      style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--color-primary)" }} />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20">
          <AlertTriangle className="h-8 w-8" style={{ color: "#DC2626" }} />
          <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
            {error}
          </p>
          <Button variant="outline" size="sm" onClick={fetchSequences}>
            ลองใหม่
          </Button>
        </div>
      ) : !data || data.sequences.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--color-primary-light)" }}
          >
            <GitBranch className="h-7 w-7" style={{ color: "var(--color-primary)" }} />
          </div>
          <p className="font-medium" style={{ color: "var(--color-ink)" }}>
            ยังไม่มี sequences
          </p>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            สร้าง sequence เพื่อส่งอีเมลอัตโนมัติแบบ multi-step
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor: "var(--color-border)" }}>
              <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                ชื่อ Sequence
              </TableHead>
              <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                สถานะ
              </TableHead>
              <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                จำนวน Steps
              </TableHead>
              <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                Active Enrollments
              </TableHead>
              <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                วันที่สร้าง
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.sequences.map((seq) => {
              const cfg = STATUS_CONFIG[seq.status] ?? STATUS_CONFIG.draft
              return (
                <TableRow
                  key={seq.id}
                  className="group transition-colors hover:bg-slate-50"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <TableCell>
                    <Link
                      href={`/${workspaceId}/sequences/${seq.id}`}
                      className="font-medium hover:underline"
                      style={{ color: "var(--color-ink)" }}
                    >
                      {seq.name}
                    </Link>
                  </TableCell>

                  <TableCell>
                    <span
                      className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
                      style={{
                        color: cfg.color,
                        backgroundColor: cfg.bg,
                        borderRadius: "var(--radius-badge)",
                      }}
                    >
                      {cfg.label}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="text-sm" style={{ color: "var(--color-ink)" }}>
                      {seq.stepsCount} steps
                    </span>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" style={{ color: "var(--color-muted)" }} />
                      <span className="text-sm" style={{ color: "var(--color-ink)" }}>
                        {seq.activeEnrollments.toLocaleString()}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                      {new Date(seq.created_at).toLocaleDateString("th-TH", {
                        day: "numeric",
                        month: "short",
                        year: "2-digit",
                      })}
                    </span>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Link href={`/${workspaceId}/sequences/${seq.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          style={{ color: "var(--color-primary)" }}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setDeletingId(seq.id)
                            setDeleteOpen(true)
                          }}
                          style={{ color: "var(--color-danger)" }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div
          className="flex items-center justify-between border-t px-5 py-3"
          style={{ borderColor: "var(--color-border)" }}
        >
          <span className="text-xs" style={{ color: "var(--color-muted)" }}>
            {data.total} sequences
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
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
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent style={{ borderRadius: "var(--radius-modal)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--color-ink)" }}>ยืนยันการลบ Sequence</DialogTitle>
            <DialogDescription style={{ color: "var(--color-muted)" }}>
              คุณต้องการลบ sequence นี้ใช่หรือไม่? Leads ที่ enrolled อยู่จะหยุดรับอีเมล
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteLoading}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleteLoading}
              style={{ backgroundColor: "var(--color-danger)", borderRadius: "var(--radius-btn)" }}
            >
              {deleteLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              ลบ Sequence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
