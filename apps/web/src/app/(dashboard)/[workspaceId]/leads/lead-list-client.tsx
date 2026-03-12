"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Star,
  Mail,
  Phone,
  Trash2,
  Sparkles,
  Download,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Filter,
  AlertTriangle,
  GitBranch,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
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
type SortBy = "score_desc" | "score_asc" | "created_desc" | "name_asc"

interface LeadScore {
  score: number
  reasoning: string
  scored_at: string
}

interface Lead {
  id: string
  name: string
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  status: LeadStatus
  rating: number | null
  review_count: number | null
  category: string | null
  created_at: string
  score: LeadScore | null
}

interface ListResult {
  leads: Lead[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface Props {
  workspaceId: string
  canEdit: boolean
  initialStatus?: string
  initialHasEmail?: string
  initialSortBy?: string
  initialPage?: number
}

// ============================================================
// Helpers
// ============================================================

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  new: { label: "ใหม่", color: "#D97706", bg: "#FEF3C7" },
  contacted: { label: "ติดต่อแล้ว", color: "#2563EB", bg: "#DBEAFE" },
  qualified: { label: "คัดแล้ว", color: "#16A34A", bg: "#F0FDF4" },
  unqualified: { label: "ไม่ผ่าน", color: "#7A6F68", bg: "#F5F0EB" },
}

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) {
    return (
      <span className="text-xs" style={{ color: "var(--color-muted)" }}>
        —
      </span>
    )
  }
  const color = score >= 80 ? "#16A34A" : score >= 50 ? "#D97706" : "#DC2626"
  const bg = score >= 80 ? "#F0FDF4" : score >= 50 ? "#FEF3C7" : "#FEF2F2"
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold"
      style={{ color, backgroundColor: bg, borderRadius: "var(--radius-badge)" }}
    >
      {score}
    </span>
  )
}

function downloadCsv(headers: string[], rows: string[][], filename: string) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))]
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ============================================================
// Component
// ============================================================

export default function LeadListClient({
  workspaceId,
  canEdit,
  initialStatus,
  initialHasEmail,
  initialSortBy,
  initialPage = 1,
}: Props) {
  // Filter state
  const [status, setStatus] = useState<string>(initialStatus ?? "all")
  const [hasEmail, setHasEmail] = useState<string>(initialHasEmail ?? "all")
  const [sortBy, setSortBy] = useState<SortBy>((initialSortBy as SortBy) ?? "created_desc")
  const [page, setPage] = useState(initialPage)

  // Data state
  const [data, setData] = useState<ListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Delete dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Export state
  const [exporting, setExporting] = useState(false)

  // Enroll in Sequence dialog
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [enrollSequenceId, setEnrollSequenceId] = useState<string>("")
  const [enrolling, setEnrolling] = useState(false)

  // ดึงข้อมูล
  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await trpc.lead.list.query({
        workspaceId,
        status: status !== "all" ? (status as LeadStatus) : undefined,
        hasEmail: hasEmail === "yes" ? true : hasEmail === "no" ? false : undefined,
        sortBy,
        page,
        pageSize: 20,
      })
      setData(result as ListResult)
      setSelectedIds(new Set())
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถดึงข้อมูล leads ได้"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [workspaceId, status, hasEmail, sortBy, page])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Toggle select row
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (!data) return
    if (selectedIds.size === data.leads.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(data.leads.map((l) => l.id)))
    }
  }

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    setDeleting(true)
    try {
      await trpc.lead.deleteBulk.mutate({
        workspaceId,
        leadIds: Array.from(selectedIds),
      })
      toast.success(`ลบ ${selectedIds.size} leads แล้ว`)
      setDeleteConfirmOpen(false)
      fetchLeads()
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถลบ leads ได้"
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  // Sequence list for enroll dialog (load lazily when dialog opens)
  const [sequences, setSequences] = useState<{ id: string; name: string }[] | null>(null)

  // Load sequences when enroll dialog opens
  const openEnrollDialog = () => {
    setEnrollSequenceId("")
    setEnrollOpen(true)
    if (sequences === null) {
      trpc.sequence.list.query({ workspaceId })
        .then((result) => {
          setSequences(result.sequences as { id: string; name: string }[])
        })
        .catch(() => setSequences([]))
    }
  }

  // Enroll leads in sequence
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
        leadIds: Array.from(selectedIds),
      })
      toast.success(`เพิ่ม ${selectedIds.size} leads เข้า sequence แล้ว`)
      setEnrollOpen(false)
      setEnrollSequenceId("")
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถเพิ่ม leads เข้า sequence ได้"
      toast.error(msg)
    } finally {
      setEnrolling(false)
    }
  }

  // Export CSV
  const handleExport = async () => {
    setExporting(true)
    try {
      const result = await trpc.lead.exportCsv.query({
        workspaceId,
        status: status !== "all" ? (status as LeadStatus) : undefined,
      })
      downloadCsv(result.headers, result.rows, `leads-${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success("ดาวน์โหลด CSV แล้ว")
    } catch {
      toast.error("ไม่สามารถ export ได้")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      className="rounded-xl border bg-white shadow-sm"
      style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
    >
      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center gap-3 border-b px-5 py-4"
        style={{ borderColor: "var(--color-border)" }}
      >
        <Filter className="h-4 w-4 shrink-0" style={{ color: "var(--color-muted)" }} />

        {/* Status filter */}
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="สถานะ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">สถานะ: ทั้งหมด</SelectItem>
            <SelectItem value="new">ใหม่</SelectItem>
            <SelectItem value="contacted">ติดต่อแล้ว</SelectItem>
            <SelectItem value="qualified">คัดแล้ว</SelectItem>
            <SelectItem value="unqualified">ไม่ผ่าน</SelectItem>
          </SelectContent>
        </Select>

        {/* Email filter */}
        <Select value={hasEmail} onValueChange={(v) => { setHasEmail(v); setPage(1) }}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="อีเมล" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">อีเมล: ทั้งหมด</SelectItem>
            <SelectItem value="yes">มีอีเมล</SelectItem>
            <SelectItem value="no">ไม่มีอีเมล</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sortBy} onValueChange={(v) => { setSortBy(v as SortBy); setPage(1) }}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="เรียงตาม" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_desc">ล่าสุดก่อน</SelectItem>
            <SelectItem value="score_desc">คะแนนสูงสุด</SelectItem>
            <SelectItem value="score_asc">คะแนนต่ำสุด</SelectItem>
            <SelectItem value="name_asc">ชื่อ A-Z</SelectItem>
          </SelectContent>
        </Select>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bulk actions (แสดงเมื่อ select อยู่) */}
        {selectedIds.size > 0 && canEdit && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
              เลือก {selectedIds.size} รายการ
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => toast.info("ฟีเจอร์ให้คะแนน AI จะพร้อมใช้เร็วๆ นี้")}
              style={{ borderRadius: "var(--radius-btn)" }}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" style={{ color: "#7C3AED" }} />
              ให้คะแนน AI
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={openEnrollDialog}
              style={{ borderRadius: "var(--radius-btn)" }}
            >
              <GitBranch className="mr-1.5 h-3.5 w-3.5" style={{ color: "var(--color-info)" }} />
              Enroll in Sequence
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setDeleteConfirmOpen(true)}
              style={{ borderRadius: "var(--radius-btn)", color: "#DC2626", borderColor: "#DC2626" }}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              ลบ
            </Button>
          </div>
        )}

        {/* Export */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={handleExport}
          disabled={exporting}
          style={{ borderRadius: "var(--radius-btn)" }}
        >
          {exporting ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-3.5 w-3.5" />
          )}
          Export CSV
        </Button>
      </div>

      {/* Table */}
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
          <Button variant="outline" size="sm" onClick={fetchLeads}>
            ลองใหม่
          </Button>
        </div>
      ) : !data || data.leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--color-primary-light)" }}
          >
            <Mail className="h-7 w-7" style={{ color: "var(--color-primary)" }} />
          </div>
          <p className="font-medium" style={{ color: "var(--color-ink)" }}>
            ยังไม่มี leads
          </p>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            เริ่มด้วยการค้นหา lead จาก Places API
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor: "var(--color-border)" }}>
              {canEdit && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedIds.size === data.leads.length && data.leads.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                ชื่อธุรกิจ
              </TableHead>
              <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                ติดต่อ
              </TableHead>
              <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                คะแนน AI
              </TableHead>
              <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                สถานะ
              </TableHead>
              <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                Rating
              </TableHead>
              <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                วันที่เพิ่ม
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.leads.map((lead) => {
              const statusCfg = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.new
              return (
                <TableRow
                  key={lead.id}
                  className="group transition-colors hover:bg-slate-50"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  {canEdit && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(lead.id)}
                        onCheckedChange={() => toggleSelect(lead.id)}
                      />
                    </TableCell>
                  )}

                  {/* ชื่อ */}
                  <TableCell>
                    <Link
                      href={`/${workspaceId}/leads/${lead.id}`}
                      className="font-medium hover:underline"
                      style={{ color: "var(--color-ink)" }}
                    >
                      {lead.name}
                    </Link>
                    {lead.address && (
                      <p className="mt-0.5 truncate text-xs max-w-[200px]" style={{ color: "var(--color-muted)" }}>
                        {lead.address}
                      </p>
                    )}
                  </TableCell>

                  {/* ติดต่อ */}
                  <TableCell>
                    <div className="space-y-1">
                      {lead.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" style={{ color: "var(--color-muted)" }} />
                          <span className="text-xs truncate max-w-[160px]" style={{ color: "var(--color-muted)" }}>
                            {lead.email}
                          </span>
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" style={{ color: "var(--color-muted)" }} />
                          <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                            {lead.phone}
                          </span>
                        </div>
                      )}
                      {!lead.email && !lead.phone && (
                        <span className="text-xs" style={{ color: "var(--color-border)" }}>
                          —
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* AI Score */}
                  <TableCell>
                    <ScoreBadge score={lead.score?.score} />
                  </TableCell>

                  {/* สถานะ */}
                  <TableCell>
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
                  </TableCell>

                  {/* Rating */}
                  <TableCell>
                    {lead.rating ? (
                      <div className="flex items-center gap-1">
                        <Star
                          className="h-3.5 w-3.5"
                          style={{ fill: "#D97706", color: "#D97706" }}
                        />
                        <span className="text-xs font-medium" style={{ color: "var(--color-ink)" }}>
                          {lead.rating.toFixed(1)}
                        </span>
                        {lead.review_count && (
                          <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                            ({lead.review_count})
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                        —
                      </span>
                    )}
                  </TableCell>

                  {/* วันที่ */}
                  <TableCell>
                    <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                      {new Date(lead.created_at).toLocaleDateString("th-TH", {
                        day: "numeric",
                        month: "short",
                        year: "2-digit",
                      })}
                    </span>
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <Link
                      href={`/${workspaceId}/leads/${lead.id}`}
                      className="flex items-center gap-1 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: "var(--color-primary)" }}
                    >
                      ดูรายละเอียด
                      <ExternalLink className="h-3 w-3" />
                    </Link>
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
            แสดง {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} จาก {data.total} รายการ
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

      {/* Enroll in Sequence Dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent style={{ borderRadius: "var(--radius-modal)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--color-ink)" }}>Enroll in Sequence</DialogTitle>
            <DialogDescription style={{ color: "var(--color-muted)" }}>
              เพิ่ม {selectedIds.size} leads ที่เลือกเข้า email sequence
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
              Enroll {selectedIds.size} Leads
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent style={{ borderRadius: "var(--radius-modal)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--color-ink)" }}>ยืนยันการลบ</DialogTitle>
            <DialogDescription style={{ color: "var(--color-muted)" }}>
              คุณต้องการลบ {selectedIds.size} leads ที่เลือกไว้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleBulkDelete}
              disabled={deleting}
              style={{ backgroundColor: "#DC2626", borderRadius: "var(--radius-btn)" }}
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              ลบ {selectedIds.size} รายการ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
