"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  Plus,
  BarChart3,
  Calendar,
  Link2,
  Trash2,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
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
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"

// ============================================================
// Types
// ============================================================

interface Report {
  id: string
  title: string
  date_from: string
  date_to: string
  share_token: string | null
  created_at: string
}

// ============================================================
// Helpers
// ============================================================

function formatDateTH(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

// ============================================================
// Sub-components
// ============================================================

function ReportCardSkeleton() {
  return (
    <div
      className="rounded-xl border bg-white p-5 animate-pulse"
      style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-4 w-48 rounded bg-gray-200 mb-2" />
          <div className="h-3 w-36 rounded bg-gray-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-16 rounded-lg bg-gray-100" />
          <div className="h-8 w-20 rounded-lg bg-gray-100" />
          <div className="h-8 w-8 rounded-lg bg-gray-100" />
        </div>
      </div>
    </div>
  )
}

function CopyButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const url = `${window.location.origin}/report/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      toast.success("คัดลอกลิงก์แล้ว")
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 text-xs gap-1.5"
      onClick={handleCopy}
      style={{ borderRadius: "var(--radius-btn)" }}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" style={{ color: "var(--color-success)" }} />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? "คัดลอกแล้ว" : "แชร์ลิงก์"}
    </Button>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function ReportsPage() {
  const params = useParams()
  const workspaceId = params.workspaceId as string

  // Data state
  const [reports, setReports] = useState<Report[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [createTitle, setCreateTitle] = useState("")
  const [createDateFrom, setCreateDateFrom] = useState("")
  const [createDateTo, setCreateDateTo] = useState("")
  const [creating, setCreating] = useState(false)

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<Report | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await trpc.report.list.query({ workspaceId })
      setReports(result.reports as Report[])
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถโหลดรายงานได้"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const handleCreate = async () => {
    if (!createTitle.trim()) {
      toast.error("กรุณาใส่ชื่อรายงาน")
      return
    }
    if (!createDateFrom || !createDateTo) {
      toast.error("กรุณาเลือกช่วงวันที่")
      return
    }
    if (createDateFrom > createDateTo) {
      toast.error("วันที่เริ่มต้นต้องน้อยกว่าวันที่สิ้นสุด")
      return
    }
    setCreating(true)
    try {
      await trpc.report.create.mutate({
        workspaceId,
        title: createTitle.trim(),
        dateFrom: createDateFrom,
        dateTo: createDateTo,
      })
      toast.success("สร้างรายงานแล้ว")
      setCreateOpen(false)
      setCreateTitle("")
      setCreateDateFrom("")
      setCreateDateTo("")
      fetchReports()
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถสร้างรายงานได้"
      toast.error(msg)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await trpc.report.delete.mutate({ workspaceId, reportId: deleteTarget.id })
      toast.success("ลบรายงานแล้ว")
      setDeleteTarget(null)
      fetchReports()
    } catch {
      toast.error("ไม่สามารถลบรายงานได้")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-canvas)" }}>
      <div className="px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
              รายงาน
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
              สร้างและแชร์รายงานผลการทำงานให้ลูกค้า
            </p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            style={{ backgroundColor: "var(--color-primary)", borderRadius: "var(--radius-btn)" }}
          >
            <Plus className="mr-2 h-4 w-4" />
            สร้างรายงานใหม่
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <ReportCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-white py-20"
            style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
          >
            <AlertTriangle className="h-8 w-8" style={{ color: "var(--color-danger)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
              {error}
            </p>
            <Button variant="outline" size="sm" onClick={fetchReports}>
              ลองใหม่
            </Button>
          </div>
        ) : !reports || reports.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-4 rounded-xl border bg-white py-20"
            style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
          >
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--color-primary-light)" }}
            >
              <BarChart3 className="h-7 w-7" style={{ color: "var(--color-primary)" }} />
            </div>
            <div className="text-center">
              <p className="font-medium" style={{ color: "var(--color-ink)" }}>
                ยังไม่มีรายงาน
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
                สร้างรายงานแรกเพื่อแชร์ผลให้ลูกค้า
              </p>
            </div>
            <Button
              onClick={() => setCreateOpen(true)}
              style={{ backgroundColor: "var(--color-primary)", borderRadius: "var(--radius-btn)" }}
            >
              <Plus className="mr-2 h-4 w-4" />
              สร้างรายงานใหม่
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="rounded-xl border bg-white p-5 transition-shadow hover:shadow-sm"
                style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: "var(--color-primary-light)" }}
                    >
                      <BarChart3 className="h-4 w-4" style={{ color: "var(--color-primary)" }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold" style={{ color: "var(--color-ink)" }}>
                        {report.title}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 shrink-0" style={{ color: "var(--color-muted)" }} />
                        <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                          {formatDateTH(report.date_from)} — {formatDateTH(report.date_to)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {report.share_token && (
                      <>
                        <a
                          href={`/report/${report.share_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1.5"
                            style={{ borderRadius: "var(--radius-btn)" }}
                          >
                            <Link2 className="h-3.5 w-3.5" />
                            ดู
                          </Button>
                        </a>
                        <CopyButton token={report.share_token} />
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setDeleteTarget(report)}
                      style={{
                        borderRadius: "var(--radius-btn)",
                        borderColor: "var(--color-danger)",
                        color: "var(--color-danger)",
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent style={{ borderRadius: "var(--radius-modal)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--color-ink)" }}>สร้างรายงานใหม่</DialogTitle>
            <DialogDescription style={{ color: "var(--color-muted)" }}>
              รายงานจะแสดงสถิติ leads, campaigns และอีเมลในช่วงเวลาที่กำหนด
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label
                className="mb-1.5 block text-sm font-medium"
                style={{ color: "var(--color-ink)" }}
              >
                ชื่อรายงาน
              </label>
              <Input
                placeholder="เช่น รายงานประจำเดือน มี.ค. 2026"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                style={{ borderRadius: "var(--radius-input)" }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium"
                  style={{ color: "var(--color-ink)" }}
                >
                  วันที่เริ่มต้น
                </label>
                <Input
                  type="date"
                  value={createDateFrom}
                  onChange={(e) => setCreateDateFrom(e.target.value)}
                  style={{ borderRadius: "var(--radius-input)" }}
                />
              </div>
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium"
                  style={{ color: "var(--color-ink)" }}
                >
                  วันที่สิ้นสุด
                </label>
                <Input
                  type="date"
                  value={createDateTo}
                  onChange={(e) => setCreateDateTo(e.target.value)}
                  style={{ borderRadius: "var(--radius-input)" }}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating}
              style={{ backgroundColor: "var(--color-primary)", borderRadius: "var(--radius-btn)" }}
            >
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              สร้างรายงาน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent style={{ borderRadius: "var(--radius-modal)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--color-ink)" }}>ยืนยันการลบ</DialogTitle>
            <DialogDescription style={{ color: "var(--color-muted)" }}>
              คุณต้องการลบรายงาน &quot;{deleteTarget?.title}&quot; ใช่หรือไม่?
              ลิงก์แชร์จะหยุดใช้งาน และไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              style={{ backgroundColor: "var(--color-danger)", borderRadius: "var(--radius-btn)" }}
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              ลบรายงาน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
