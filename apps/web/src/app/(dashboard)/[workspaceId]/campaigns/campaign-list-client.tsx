"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  MailOpen,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Eye,
  MoreHorizontal,
  Play,
  Pause,
  Pencil,
  Building2,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

const STATUS_CONFIG: Record<
  CampaignStatus,
  { label: string; color: string; bg: string; dot: string }
> = {
  draft: { label: "ร่าง", color: "#7A6F68", bg: "#F5F0EB", dot: "#7A6F68" },
  scheduled: { label: "กำหนดเวลา", color: "#2563EB", bg: "#DBEAFE", dot: "#2563EB" },
  sending: { label: "กำลังส่ง", color: "#16A34A", bg: "#F0FDF4", dot: "#16A34A" },
  paused: { label: "หยุดชั่วคราว", color: "#D97706", bg: "#FEF3C7", dot: "#D97706" },
  completed: { label: "เสร็จสิ้น", color: "#0F766E", bg: "#F0FDFA", dot: "#0F766E" },
  cancelled: { label: "ยกเลิก", color: "#DC2626", bg: "#FEF2F2", dot: "#DC2626" },
}

// สีพื้นหลัง avatar แต่ละแคมเปญ (วน index)
const AVATAR_COLORS = [
  { bg: "#EEF2F8", color: "#1E3A5F" },
  { bg: "#F0FDF4", color: "#16A34A" },
  { bg: "#FEF3C7", color: "#D97706" },
  { bg: "#EDE9FE", color: "#7C3AED" },
  { bg: "#FEE2E2", color: "#DC2626" },
  { bg: "#DBEAFE", color: "#2563EB" },
]

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "—"
  return `${Math.round((numerator / denominator) * 100)}%`
}

function formatThaiDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

// ============================================================
// Sub-components
// ============================================================

function StatusBadge({ status }: { status: CampaignStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium"
      style={{
        color: cfg.color,
        backgroundColor: cfg.bg,
        borderRadius: "var(--radius-badge)",
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: cfg.dot }}
      />
      {cfg.label}
    </span>
  )
}

function CampaignAvatar({ name, index }: { name: string; index: number }) {
  const colorSet = AVATAR_COLORS[index % AVATAR_COLORS.length]
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: colorSet.bg }}
    >
      <Building2 className="h-5 w-5" style={{ color: colorSet.color }} />
    </div>
  )
}

function ColumnHeader({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide"
      style={{ color: "var(--color-muted)" }}
    >
      {children}
    </th>
  )
}

function StatCell({ value, color }: { value: string; color?: string }) {
  return (
    <td className="px-4 py-4 text-right">
      <span
        className="text-sm font-semibold tabular-nums"
        style={{ color: color ?? "var(--color-ink)" }}
      >
        {value}
      </span>
    </td>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function CampaignListClient({
  workspaceId,
  canEdit,
  initialStatus,
  initialPage = 1,
}: Props) {
  const [status, setStatus] = useState<string>(initialStatus ?? "all")
  const [page, setPage] = useState(initialPage)
  const pageSize = 5

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
        pageSize,
      })
      setData(result as unknown as ListResult)
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถดึงข้อมูลแคมเปญได้"
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
      toast.success("ลบแคมเปญแล้ว")
      setDeleteOpen(false)
      setDeletingId(null)
      fetchCampaigns()
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถลบแคมเปญได้"
      toast.error(msg)
    } finally {
      setDeleteLoading(false)
    }
  }

  const handlePause = async (campaignId: string) => {
    try {
      await trpc.campaign.pause.mutate({ workspaceId, campaignId })
      toast.success("หยุดแคมเปญชั่วคราวแล้ว")
      fetchCampaigns()
    } catch {
      toast.error("ไม่สามารถหยุดแคมเปญได้")
    }
  }

  const handleResume = async (campaignId: string) => {
    try {
      await trpc.campaign.sendNow.mutate({ workspaceId, campaignId })
      toast.success("ส่งต่อแคมเปญแล้ว")
      fetchCampaigns()
    } catch {
      toast.error("ไม่สามารถส่งต่อแคมเปญได้")
    }
  }

  // คำนวณ pagination info
  const showingFrom = data ? (page - 1) * pageSize + 1 : 0
  const showingTo = data ? Math.min(page * pageSize, data.total) : 0

  return (
    <>
      {/* Card Container */}
      <div
        className="overflow-hidden rounded-xl border bg-white shadow-sm"
        style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
      >
        {/* Filter Row */}
        <div
          className="flex items-center justify-between border-b px-5 py-3.5"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex items-center gap-2">
            {/* สถานะ */}
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v)
                setPage(1)
              }}
            >
              <SelectTrigger
                className="h-8 w-40 text-xs"
                style={{ borderRadius: "var(--radius-input)", borderColor: "var(--color-border)" }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">สถานะ: ทั้งหมด</SelectItem>
                <SelectItem value="sending">กำลังส่ง</SelectItem>
                <SelectItem value="paused">หยุดชั่วคราว</SelectItem>
                <SelectItem value="completed">เสร็จสิ้น</SelectItem>
                <SelectItem value="draft">ร่าง</SelectItem>
                <SelectItem value="scheduled">กำหนดเวลา</SelectItem>
                <SelectItem value="cancelled">ยกเลิก</SelectItem>
              </SelectContent>
            </Select>

            {/* หมวดหมู่ (placeholder) */}
            <Select defaultValue="all-category">
              <SelectTrigger
                className="h-8 w-44 text-xs"
                style={{ borderRadius: "var(--radius-input)", borderColor: "var(--color-border)" }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-category">หมวดหมู่: ทั้งหมด</SelectItem>
              </SelectContent>
            </Select>

            {/* Workspace (placeholder) */}
            <Select defaultValue="all-ws">
              <SelectTrigger
                className="h-8 w-48 text-xs"
                style={{ borderRadius: "var(--radius-input)", borderColor: "var(--color-border)" }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-ws">Workspace: ทั้งหมด</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort */}
          <span className="text-xs" style={{ color: "var(--color-muted)" }}>
            จัดเรียง:{" "}
            <button className="font-medium" style={{ color: "var(--color-ink)" }}>
              ล่าสุด
            </button>
          </span>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--color-primary)" }} />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <AlertTriangle className="h-8 w-8" style={{ color: "var(--color-danger)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
              {error}
            </p>
            <Button variant="outline" size="sm" onClick={fetchCampaigns}>
              ลองใหม่
            </Button>
          </div>
        ) : !data || data.campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--color-primary-light)" }}
            >
              <MailOpen className="h-7 w-7" style={{ color: "var(--color-primary)" }} />
            </div>
            <p className="font-semibold" style={{ color: "var(--color-ink)" }}>
              ยังไม่มีแคมเปญ
            </p>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              เริ่มสร้างแคมเปญแรกของคุณเลย
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            {/* Column Headers */}
            <thead>
              <tr style={{ borderBottom: `1px solid var(--color-border)` }}>
                <th
                  className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--color-muted)" }}
                >
                  ชื่อแคมเปญ
                </th>
                <ColumnHeader>ส่งแล้ว</ColumnHeader>
                <ColumnHeader>Open Rate</ColumnHeader>
                <ColumnHeader>Click Rate</ColumnHeader>
                <ColumnHeader>ตอบกลับ</ColumnHeader>
                <th className="px-4 py-3" />
              </tr>
            </thead>

            <tbody>
              {data.campaigns.map((campaign, index) => {
                const cfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft
                const { stats } = campaign
                const isDraft = campaign.status === "draft"
                const isPaused = campaign.status === "paused"
                const totalSent = stats.sent + stats.opened + stats.clicked

                // Open rate = (opened + clicked) / totalSent
                const openRate = pct(stats.opened + stats.clicked, totalSent)
                const clickRate = pct(stats.clicked, totalSent)

                const rowBg = isPaused ? "#FFFBEB" : "transparent"

                return (
                  <tr
                    key={campaign.id}
                    className="group transition-colors"
                    style={{
                      borderBottom: `1px solid var(--color-border)`,
                      backgroundColor: rowBg,
                    }}
                    onMouseEnter={(e) => {
                      if (!isPaused) {
                        e.currentTarget.style.backgroundColor = "var(--color-canvas)"
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = rowBg
                    }}
                  >
                    {/* ชื่อแคมเปญ */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <CampaignAvatar name={campaign.name} index={index} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/${workspaceId}/campaigns/${campaign.id}`}
                              className="font-semibold hover:underline"
                              style={{ color: "var(--color-ink)" }}
                            >
                              {campaign.name}
                            </Link>
                            <StatusBadge status={campaign.status} />
                          </div>
                          <p
                            className="mt-0.5 truncate text-xs"
                            style={{ color: "var(--color-muted)", maxWidth: "320px" }}
                          >
                            {campaign.email_templates?.name
                              ? `${campaign.email_templates.name} · `
                              : ""}
                            {stats.total.toLocaleString()} รายชื่อ
                            {campaign.scheduled_at || campaign.created_at
                              ? ` · เริ่ม ${formatThaiDate(campaign.scheduled_at ?? campaign.created_at)}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* ส่งแล้ว */}
                    <StatCell
                      value={isDraft ? "—" : totalSent.toLocaleString()}
                      color={isDraft ? "var(--color-muted)" : "var(--color-ink)"}
                    />

                    {/* Open Rate */}
                    <StatCell
                      value={isDraft ? "—" : openRate}
                      color={
                        isDraft
                          ? "var(--color-muted)"
                          : openRate === "—"
                            ? "var(--color-muted)"
                            : "var(--color-success)"
                      }
                    />

                    {/* Click Rate */}
                    <StatCell
                      value={isDraft ? "—" : clickRate}
                      color={
                        isDraft
                          ? "var(--color-muted)"
                          : clickRate === "—"
                            ? "var(--color-muted)"
                            : "var(--color-success)"
                      }
                    />

                    {/* ตอบกลับ */}
                    <StatCell
                      value={isDraft ? "—" : stats.bounced.toLocaleString()}
                      color={isDraft ? "var(--color-muted)" : "var(--color-ink)"}
                    />

                    {/* Actions */}
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* Draft: ปุ่มแก้ไข */}
                        {isDraft && canEdit && (
                          <Link href={`/${workspaceId}/campaigns/${campaign.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 text-xs"
                              style={{
                                borderRadius: "var(--radius-btn)",
                                borderColor: "var(--color-border)",
                                color: "var(--color-ink)",
                              }}
                            >
                              <Pencil className="mr-1.5 h-3.5 w-3.5" />
                              แก้ไข
                            </Button>
                          </Link>
                        )}

                        {/* Paused: ปุ่มส่งต่อ */}
                        {isPaused && canEdit && (
                          <Button
                            size="sm"
                            className="h-8 px-3 text-xs"
                            style={{
                              backgroundColor: "var(--color-success)",
                              color: "white",
                              borderRadius: "var(--radius-btn)",
                            }}
                            onClick={() => handleResume(campaign.id)}
                          >
                            <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
                            ส่งต่อ
                          </Button>
                        )}

                        {/* Eye icon — ดูรายละเอียด */}
                        <Link href={`/${workspaceId}/campaigns/${campaign.id}`}>
                          <button
                            className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-slate-100"
                            style={{ borderRadius: "var(--radius-input)" }}
                            title="ดูรายละเอียด"
                          >
                            <Eye className="h-4 w-4" style={{ color: "var(--color-muted)" }} />
                          </button>
                        </Link>

                        {/* Three-dot menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-slate-100"
                              style={{ borderRadius: "var(--radius-input)" }}
                              title="เพิ่มเติม"
                            >
                              <MoreHorizontal
                                className="h-4 w-4"
                                style={{ color: "var(--color-muted)" }}
                              />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" style={{ minWidth: "160px" }}>
                            <DropdownMenuItem asChild>
                              <Link href={`/${workspaceId}/campaigns/${campaign.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                ดูรายละเอียด
                              </Link>
                            </DropdownMenuItem>

                            {canEdit && campaign.status === "sending" && (
                              <DropdownMenuItem onClick={() => handlePause(campaign.id)}>
                                <Pause className="mr-2 h-4 w-4" />
                                หยุดชั่วคราว
                              </DropdownMenuItem>
                            )}

                            {canEdit && isPaused && (
                              <DropdownMenuItem onClick={() => handleResume(campaign.id)}>
                                <Play className="mr-2 h-4 w-4" />
                                ส่งต่อ
                              </DropdownMenuItem>
                            )}

                            {canEdit && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => {
                                    setDeletingId(campaign.id)
                                    setDeleteOpen(true)
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  ลบแคมเปญ
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {data && data.total > 0 && (
          <div
            className="flex items-center justify-between border-t px-5 py-3.5"
            style={{ borderColor: "var(--color-border)" }}
          >
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>
              แสดง {showingFrom}–{showingTo} จาก {data.total} แคมเปญ
            </span>

            {data.totalPages > 1 && (
              <div className="flex items-center gap-1">
                {/* Previous */}
                <button
                  className="flex h-8 w-8 items-center justify-center rounded transition-colors disabled:opacity-40"
                  style={{
                    border: `1px solid var(--color-border)`,
                    borderRadius: "var(--radius-input)",
                    color: "var(--color-ink)",
                  }}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {/* Page numbers */}
                {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    className="flex h-8 w-8 items-center justify-center rounded text-xs font-medium transition-colors"
                    style={{
                      borderRadius: "var(--radius-input)",
                      backgroundColor:
                        p === page ? "var(--color-primary)" : "transparent",
                      color: p === page ? "white" : "var(--color-ink)",
                      border:
                        p === page
                          ? "1px solid var(--color-primary)"
                          : `1px solid var(--color-border)`,
                    }}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ))}

                {/* Next */}
                <button
                  className="flex h-8 w-8 items-center justify-center rounded transition-colors disabled:opacity-40"
                  style={{
                    border: `1px solid var(--color-border)`,
                    borderRadius: "var(--radius-input)",
                    color: "var(--color-ink)",
                  }}
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent style={{ borderRadius: "var(--radius-modal)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--color-ink)" }}>ยืนยันการลบแคมเปญ</DialogTitle>
            <DialogDescription style={{ color: "var(--color-muted)" }}>
              คุณต้องการลบแคมเปญนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
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
              ลบแคมเปญ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
