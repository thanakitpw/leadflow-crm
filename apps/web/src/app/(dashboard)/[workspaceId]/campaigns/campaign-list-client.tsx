"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  MailOpen,
  MousePointerClick,
  AlertTriangle,
  Loader2,
  Filter,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Send,
  Pause,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
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

type CampaignStatus = "draft" | "scheduled" | "sending" | "paused" | "completed" | "cancelled"

interface CampaignStats {
  total: number
  sent: number
  opened: number
  clicked: number
  bounced: number
}

interface Campaign {
  id: string
  name: string
  status: CampaignStatus
  scheduled_at: string | null
  created_at: string
  stats: CampaignStats
  email_templates: { name: string } | null
}

interface ListResult {
  campaigns: Campaign[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface Props {
  workspaceId: string
  canEdit: boolean
  initialStatus?: string
  initialPage?: number
}

// ============================================================
// Helpers
// ============================================================

const STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "#7A6F68", bg: "#F5F0EB" },
  scheduled: { label: "กำหนดเวลา", color: "#2563EB", bg: "#DBEAFE" },
  sending: { label: "กำลังส่ง", color: "#16A34A", bg: "#F0FDF4" },
  paused: { label: "หยุดชั่วคราว", color: "#D97706", bg: "#FEF3C7" },
  completed: { label: "เสร็จสิ้น", color: "#16A34A", bg: "#F0FDF4" },
  cancelled: { label: "ยกเลิก", color: "#DC2626", bg: "#FEF2F2" },
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "—"
  return `${Math.round((numerator / denominator) * 100)}%`
}

// ============================================================
// Component
// ============================================================

export default function CampaignListClient({
  workspaceId,
  canEdit,
  initialStatus,
  initialPage = 1,
}: Props) {
  const [status, setStatus] = useState<string>(initialStatus ?? "all")
  const [page, setPage] = useState(initialPage)

  const [data, setData] = useState<ListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await trpc.campaign.list.query({
        workspaceId,
        status: status !== "all" ? (status as CampaignStatus) : undefined,
        page,
        pageSize: 20,
      })
      setData(result as unknown as ListResult)
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถดึงข้อมูล campaigns ได้"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [workspaceId, status, page])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  const handleDelete = async () => {
    if (!deletingId) return
    setDeleteLoading(true)
    try {
      await trpc.campaign.delete.mutate({ workspaceId, campaignId: deletingId })
      toast.success("ลบ campaign แล้ว")
      setDeleteOpen(false)
      setDeletingId(null)
      fetchCampaigns()
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถลบ campaign ได้"
      toast.error(msg)
    } finally {
      setDeleteLoading(false)
    }
  }

  const handlePause = async (campaignId: string) => {
    try {
      await trpc.campaign.pause.mutate({ workspaceId, campaignId })
      toast.success("หยุด campaign แล้ว")
      fetchCampaigns()
    } catch {
      toast.error("ไม่สามารถหยุด campaign ได้")
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

        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="สถานะ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">สถานะ: ทั้งหมด</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">กำหนดเวลา</SelectItem>
            <SelectItem value="sending">กำลังส่ง</SelectItem>
            <SelectItem value="paused">หยุดชั่วคราว</SelectItem>
            <SelectItem value="completed">เสร็จสิ้น</SelectItem>
            <SelectItem value="cancelled">ยกเลิก</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
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
          <Button variant="outline" size="sm" onClick={fetchCampaigns}>
            ลองใหม่
          </Button>
        </div>
      ) : !data || data.campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--color-primary-light)" }}
          >
            <MailOpen className="h-7 w-7" style={{ color: "var(--color-primary)" }} />
          </div>
          <p className="font-medium" style={{ color: "var(--color-ink)" }}>
            ยังไม่มี campaigns
          </p>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            เริ่มสร้าง campaign แรกของคุณเลย
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor: "var(--color-border)" }}>
              <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                ชื่อ Campaign
              </TableHead>
              <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                สถานะ
              </TableHead>
              <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                Recipients
              </TableHead>
              <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                Sent
              </TableHead>
              <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                Open Rate
              </TableHead>
              <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                Click Rate
              </TableHead>
              <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                วันที่
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.campaigns.map((campaign) => {
              const cfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft
              const { stats } = campaign
              const totalDelivered = stats.sent + stats.opened + stats.clicked

              return (
                <TableRow
                  key={campaign.id}
                  className="group transition-colors hover:bg-slate-50"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  {/* ชื่อ */}
                  <TableCell>
                    <Link
                      href={`/${workspaceId}/campaigns/${campaign.id}`}
                      className="font-medium hover:underline"
                      style={{ color: "var(--color-ink)" }}
                    >
                      {campaign.name}
                    </Link>
                    {campaign.email_templates && (
                      <p
                        className="mt-0.5 truncate text-xs max-w-[200px]"
                        style={{ color: "var(--color-muted)" }}
                      >
                        {campaign.email_templates.name}
                      </p>
                    )}
                  </TableCell>

                  {/* สถานะ */}
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

                  {/* Recipients */}
                  <TableCell>
                    <span className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                      {stats.total.toLocaleString()}
                    </span>
                  </TableCell>

                  {/* Sent */}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Send className="h-3.5 w-3.5" style={{ color: "var(--color-muted)" }} />
                      <span className="text-sm" style={{ color: "var(--color-ink)" }}>
                        {pct(totalDelivered, stats.total)}
                      </span>
                    </div>
                  </TableCell>

                  {/* Open Rate */}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MailOpen className="h-3.5 w-3.5" style={{ color: "#2563EB" }} />
                      <span className="text-sm font-medium" style={{ color: "#2563EB" }}>
                        {pct(stats.opened + stats.clicked, totalDelivered)}
                      </span>
                    </div>
                  </TableCell>

                  {/* Click Rate */}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MousePointerClick className="h-3.5 w-3.5" style={{ color: "#7C3AED" }} />
                      <span className="text-sm font-medium" style={{ color: "#7C3AED" }}>
                        {pct(stats.clicked, totalDelivered)}
                      </span>
                    </div>
                  </TableCell>

                  {/* วันที่ */}
                  <TableCell>
                    <div className="space-y-0.5">
                      {campaign.scheduled_at ? (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" style={{ color: "var(--color-muted)" }} />
                          <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                            {new Date(campaign.scheduled_at).toLocaleDateString("th-TH", {
                              day: "numeric",
                              month: "short",
                              year: "2-digit",
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                          {new Date(campaign.created_at).toLocaleDateString("th-TH", {
                            day: "numeric",
                            month: "short",
                            year: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {canEdit && campaign.status === "sending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handlePause(campaign.id)}
                        >
                          <Pause className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canEdit && campaign.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setDeletingId(campaign.id)
                            setDeleteOpen(true)
                          }}
                          style={{ color: "var(--color-danger)" }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Link
                        href={`/${workspaceId}/campaigns/${campaign.id}`}
                        className="text-xs px-2 py-1 rounded"
                        style={{ color: "var(--color-primary)" }}
                      >
                        ดูรายละเอียด
                      </Link>
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

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent style={{ borderRadius: "var(--radius-modal)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--color-ink)" }}>ยืนยันการลบ Campaign</DialogTitle>
            <DialogDescription style={{ color: "var(--color-muted)" }}>
              คุณต้องการลบ campaign นี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteLoading}
            >
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
              ลบ Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
