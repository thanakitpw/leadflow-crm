"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  Send,
  MailOpen,
  MousePointerClick,
  MessageSquare,
  AlertTriangle,
  Loader2,
  Pause,
  Play,
  XCircle,
  Mail,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  BarChart2,
  Download,
  Pencil,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"

// ============================================================
// Types
// ============================================================

type CampaignStatus = "draft" | "scheduled" | "sending" | "paused" | "completed" | "cancelled"
type ContactStatus = "pending" | "sent" | "opened" | "clicked" | "bounced" | "unsubscribed"

interface CampaignDetail {
  id: string
  name: string
  status: CampaignStatus
  scheduled_at: string | null
  created_at: string
  stats: {
    total: number
    sent: number
    opened: number
    clicked: number
    bounced: number
    pending: number
  }
  email_templates: { id: string; name: string; subject: string; body?: string } | null
  sending_domains: { id: string; domain: string } | null
}

interface Contact {
  id: string
  status: ContactStatus
  sent_at: string | null
  opened_at: string | null
  clicked_at: string | null
  bounced_at: string | null
  leads: { id: string; name: string; email: string | null } | null
}

// ============================================================
// Helpers
// ============================================================

const STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "#7A6F68", bg: "#F5F0EB" },
  scheduled: { label: "กำหนดเวลา", color: "#2563EB", bg: "#DBEAFE" },
  sending: { label: "กำลังส่ง", color: "#16A34A", bg: "#DCFCE7" },
  paused: { label: "หยุดชั่วคราว", color: "#D97706", bg: "#FEF3C7" },
  completed: { label: "เสร็จสิ้น", color: "#16A34A", bg: "#DCFCE7" },
  cancelled: { label: "ยกเลิก", color: "#DC2626", bg: "#FEF2F2" },
}

const CONTACT_STATUS_CONFIG: Record<ContactStatus, { label: string; color: string; bg: string }> = {
  pending: { label: "รอส่ง", color: "#7A6F68", bg: "#F5F0EB" },
  sent: { label: "ส่งแล้ว", color: "#7A6F68", bg: "#F5F0EB" },
  opened: { label: "เปิดแล้ว", color: "#2563EB", bg: "#DBEAFE" },
  clicked: { label: "คลิกแล้ว", color: "#7C3AED", bg: "#F5F3FF" },
  bounced: { label: "Bounced", color: "#DC2626", bg: "#FEF2F2" },
  unsubscribed: { label: "Unsubscribed", color: "#7A6F68", bg: "#F5F0EB" },
}

function pct(num: number, den: number): string {
  if (den === 0) return "0%"
  return `${((num / den) * 100).toFixed(1)}%`
}

function formatThaiDate(date: Date): string {
  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  })
}

function formatThaiDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ============================================================
// Sub-components
// ============================================================

function StatCard({
  label,
  value,
  sub,
  valueColor,
  subColor,
  trendUp,
}: {
  label: string
  value: string | number
  sub?: string
  valueColor?: string
  subColor?: string
  trendUp?: boolean
}) {
  return (
    <div
      className="rounded-xl border bg-white p-5"
      style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
    >
      <p className="mb-3 text-xs font-medium" style={{ color: "var(--color-muted)" }}>
        {label}
      </p>
      <p
        className="text-2xl font-bold"
        style={{ color: valueColor ?? "var(--color-ink)" }}
      >
        {value}
      </p>
      {sub && (
        <p
          className="mt-1 flex items-center gap-1 text-xs"
          style={{ color: subColor ?? "var(--color-muted)" }}
        >
          {trendUp !== undefined && (
            <TrendingUp
              className="h-3 w-3"
              style={{ color: trendUp ? "var(--color-success)" : "var(--color-danger)" }}
            />
          )}
          {sub}
        </p>
      )}
    </div>
  )
}

function SidebarCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl border bg-white"
      style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
    >
      <div
        className="border-b px-5 py-4"
        style={{ borderColor: "var(--color-border)" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
          {title}
        </h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function SidebarRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="shrink-0 text-xs" style={{ color: "var(--color-muted)" }}>
        {label}
      </span>
      <span className="text-right text-xs font-medium" style={{ color: "var(--color-ink)" }}>
        {children}
      </span>
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function CampaignDetailPage() {
  const params = useParams()
  const workspaceId = params.workspaceId as string
  const campaignId = params.campaignId as string

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactsTotal, setContactsTotal] = useState(0)
  const [contactsPage, setContactsPage] = useState(1)
  const [contactsTotalPages, setContactsTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [contactsLoading, setContactsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const fetchCampaign = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await trpc.campaign.getById.query({ workspaceId, campaignId })
      setCampaign(result as unknown as CampaignDetail)
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถดึงข้อมูล campaign ได้"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [workspaceId, campaignId])

  const fetchContacts = useCallback(async () => {
    setContactsLoading(true)
    try {
      const result = await trpc.campaign.getContacts.query({
        workspaceId,
        campaignId,
        page: contactsPage,
        pageSize: 20,
      })
      setContacts(result.contacts as unknown as Contact[])
      setContactsTotal(result.total)
      setContactsTotalPages(result.totalPages)
    } catch {
      // silent
    } finally {
      setContactsLoading(false)
    }
  }, [workspaceId, campaignId, contactsPage])

  useEffect(() => {
    fetchCampaign()
  }, [fetchCampaign])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  const handlePause = async () => {
    try {
      await trpc.campaign.pause.mutate({ workspaceId, campaignId })
      toast.success("หยุด campaign แล้ว")
      fetchCampaign()
    } catch {
      toast.error("ไม่สามารถหยุด campaign ได้")
    }
  }

  const handleCancel = async () => {
    try {
      await trpc.campaign.cancel.mutate({ workspaceId, campaignId })
      toast.success("ยกเลิก campaign แล้ว")
      fetchCampaign()
    } catch {
      toast.error("ไม่สามารถยกเลิก campaign ได้")
    }
  }

  // ── Loading State ────────────────────────────────────────────
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

  // ── Error State ──────────────────────────────────────────────
  if (error || !campaign) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3"
        style={{ backgroundColor: "var(--color-canvas)" }}
      >
        <AlertTriangle className="h-8 w-8" style={{ color: "var(--color-danger)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
          {error ?? "ไม่พบ campaign"}
        </p>
        <Link href={`/${workspaceId}/campaigns`}>
          <Button variant="outline" size="sm">
            กลับไปหน้า Campaigns
          </Button>
        </Link>
      </div>
    )
  }

  // ── Computed Values ──────────────────────────────────────────
  const statusCfg = STATUS_CONFIG[campaign.status]
  const { stats } = campaign
  const totalDelivered = stats.sent + stats.opened + stats.clicked
  const totalContacts = stats.total || 1
  const progressPct = Math.round((totalDelivered / totalContacts) * 100)
  const openRate = totalDelivered > 0 ? (stats.opened + stats.clicked) / totalDelivered : 0
  const clickRate = totalDelivered > 0 ? stats.clicked / totalDelivered : 0
  const bounceRate = totalDelivered > 0 ? stats.bounced / totalDelivered : 0
  const replyCount = 0 // placeholder — extend schema when reply tracking available
  const replyRate = totalDelivered > 0 ? replyCount / totalDelivered : 0

  const createdDate = new Date(campaign.created_at)
  const completedDate =
    campaign.status === "completed" && campaign.scheduled_at
      ? new Date(campaign.scheduled_at)
      : null

  // Daily limit mock data — replace with actual DB field when available
  const dailyLimit = 50
  const sentToday = Math.min(totalDelivered, dailyLimit)
  const sentTodayPct = Math.round((sentToday / dailyLimit) * 100)

  // Filter contacts by status
  const filteredContacts =
    statusFilter === "all"
      ? contacts
      : contacts.filter((c) => c.status === statusFilter)

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-canvas)" }}>
      <div className="mx-auto max-w-[1280px] px-8 py-8">

        {/* ── Header bar ─────────────────────────────────────── */}
        <div className="mb-6 flex items-center justify-between gap-4">
          {/* Breadcrumb + status badge */}
          <div className="flex items-center gap-3 min-w-0">
            <nav className="flex items-center gap-1.5 text-sm" style={{ color: "var(--color-muted)" }}>
              <Link
                href={`/${workspaceId}/campaigns`}
                className="hover:underline transition-colors"
                style={{ color: "var(--color-muted)" }}
              >
                แคมเปญ
              </Link>
              <span>/</span>
              <span
                className="font-semibold truncate max-w-[320px]"
                style={{ color: "var(--color-ink)" }}
              >
                {campaign.name}
              </span>
            </nav>
            <span
              className="inline-flex shrink-0 items-center px-2.5 py-0.5 text-xs font-semibold"
              style={{
                color: statusCfg.color,
                backgroundColor: statusCfg.bg,
                borderRadius: "var(--radius-badge)",
              }}
            >
              {statusCfg.label}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex shrink-0 items-center gap-2">
            {campaign.status === "sending" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePause}
                className="gap-2 font-medium"
                style={{
                  borderRadius: "var(--radius-btn)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-ink)",
                }}
              >
                <Pause className="h-4 w-4" />
                หยุดชั่วคราว
              </Button>
            )}
            {campaign.status === "paused" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.info("ฟีเจอร์ resume จะพร้อมเร็วๆ นี้")}
                className="gap-2 font-medium"
                style={{
                  borderRadius: "var(--radius-btn)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-ink)",
                }}
              >
                <Play className="h-4 w-4" />
                ส่งต่อ
              </Button>
            )}
            {["draft", "scheduled", "sending", "paused"].includes(campaign.status) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="gap-1.5 text-xs"
                style={{
                  borderRadius: "var(--radius-btn)",
                  color: "var(--color-danger)",
                }}
              >
                <XCircle className="h-3.5 w-3.5" />
                ยกเลิก
              </Button>
            )}
            <Button
              size="sm"
              className="gap-2 font-medium text-white"
              style={{
                backgroundColor: "var(--color-primary)",
                borderRadius: "var(--radius-btn)",
              }}
              onClick={() => toast.info("รายงานจะพร้อมเร็วๆ นี้")}
            >
              <BarChart2 className="h-4 w-4" />
              ดูรายงาน
            </Button>
          </div>
        </div>

        {/* ── Two-column layout ───────────────────────────────── */}
        <div className="flex gap-6 items-start">

          {/* ── Left column: stats + progress + table ──────────── */}
          <div className="min-w-0 flex-1 space-y-5">

            {/* Stats cards row (5 cards) */}
            <div className="grid grid-cols-5 gap-4">
              {/* 1. ส่งทั้งหมด */}
              <StatCard
                label="ส่งทั้งหมด"
                value={totalDelivered.toLocaleString()}
                sub={`จาก ${stats.total.toLocaleString()} รายชื่อ`}
                valueColor="var(--color-ink)"
              />

              {/* 2. Open Rate */}
              <StatCard
                label="Open Rate"
                value={`${(openRate * 100).toFixed(1)}%`}
                sub={openRate > 0.3 ? "↑ สูงกว่าค่าเฉลี่ย" : "≈ ค่าเฉลี่ยทั่วไป"}
                valueColor="var(--color-success)"
                subColor="var(--color-success)"
                trendUp={openRate > 0.3}
              />

              {/* 3. Click Rate */}
              <StatCard
                label="Click Rate"
                value={`${(clickRate * 100).toFixed(1)}%`}
                sub={clickRate > 0.1 ? "↑ สูงกว่าค่าเฉลี่ย" : "≈ ค่าเฉลี่ยทั่วไป"}
                valueColor="var(--color-success)"
                subColor="var(--color-success)"
                trendUp={clickRate > 0.1}
              />

              {/* 4. ตอบกลับ */}
              <StatCard
                label="ตอบกลับ"
                value={replyCount}
                sub={`${(replyRate * 100).toFixed(1)}% reply rate`}
                valueColor="var(--color-ink)"
                subColor="var(--color-muted)"
              />

              {/* 5. Bounce */}
              <StatCard
                label="Bounce"
                value={`${(bounceRate * 100).toFixed(1)}%`}
                sub={bounceRate < 0.02 ? "ปกติ < 2%" : "สูงกว่าที่แนะนำ"}
                valueColor={bounceRate >= 0.02 ? "var(--color-danger)" : "var(--color-success)"}
                subColor={bounceRate >= 0.02 ? "var(--color-danger)" : "var(--color-success)"}
              />
            </div>

            {/* Progress bar */}
            <div
              className="rounded-xl border bg-white px-6 py-5"
              style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                  ความคืบหน้า
                </span>
                <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                  {totalDelivered.toLocaleString()} / {stats.total.toLocaleString()} รายชื่อ
                  {campaign.status === "completed" && (
                    <span className="ml-2 font-medium" style={{ color: "var(--color-success)" }}>
                      · ส่งครบแล้ว
                    </span>
                  )}
                </span>
              </div>

              {/* Track */}
              <div
                className="relative h-2 overflow-hidden rounded-full"
                style={{ backgroundColor: "var(--color-subtle)" }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPct}%`,
                    backgroundColor: "var(--color-success)",
                  }}
                />
              </div>

              {/* Dates */}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                  เริ่ม {formatThaiDate(createdDate)}
                </span>
                {completedDate ? (
                  <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                    ส่งเสร็จ {formatThaiDate(completedDate)}
                  </span>
                ) : campaign.scheduled_at ? (
                  <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                    กำหนด {formatThaiDate(new Date(campaign.scheduled_at))}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Recipients table */}
            <div
              className="rounded-xl border bg-white shadow-sm"
              style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
            >
              {/* Table header */}
              <div
                className="flex items-center justify-between border-b px-5 py-4"
                style={{ borderColor: "var(--color-border)" }}
              >
                <h2 className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                  รายชื่อผู้รับ
                  <span className="ml-2 text-xs font-normal" style={{ color: "var(--color-muted)" }}>
                    ({contactsTotal.toLocaleString()})
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger
                      className="h-8 w-32 text-xs"
                      style={{
                        borderColor: "var(--color-border)",
                        borderRadius: "var(--radius-input)",
                      }}
                    >
                      <SelectValue placeholder="ทุกสถานะ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกสถานะ</SelectItem>
                      <SelectItem value="pending">รอส่ง</SelectItem>
                      <SelectItem value="sent">ส่งแล้ว</SelectItem>
                      <SelectItem value="opened">เปิดแล้ว</SelectItem>
                      <SelectItem value="clicked">คลิกแล้ว</SelectItem>
                      <SelectItem value="bounced">Bounced</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    style={{
                      borderColor: "var(--color-border)",
                      borderRadius: "var(--radius-btn)",
                      color: "var(--color-muted)",
                    }}
                    onClick={() => toast.info("Export จะพร้อมเร็วๆ นี้")}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </Button>
                </div>
              </div>

              {/* Table body */}
              {contactsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2
                    className="h-5 w-5 animate-spin"
                    style={{ color: "var(--color-primary)" }}
                  />
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: "var(--color-primary-light)" }}
                  >
                    <Mail className="h-6 w-6" style={{ color: "var(--color-primary)" }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                    ไม่มีรายชื่อ{statusFilter !== "all" ? `สถานะนี้` : "ใน campaign นี้"}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow
                      style={{
                        borderColor: "var(--color-border)",
                        backgroundColor: "var(--color-canvas)",
                      }}
                    >
                      <TableHead
                        className="text-xs font-semibold"
                        style={{ color: "var(--color-muted)" }}
                      >
                        ชื่อ / อีเมล
                      </TableHead>
                      <TableHead
                        className="text-xs font-semibold"
                        style={{ color: "var(--color-muted)" }}
                      >
                        ส่งเมื่อ
                      </TableHead>
                      <TableHead
                        className="text-center text-xs font-semibold"
                        style={{ color: "var(--color-muted)" }}
                      >
                        เปิด
                      </TableHead>
                      <TableHead
                        className="text-center text-xs font-semibold"
                        style={{ color: "var(--color-muted)" }}
                      >
                        คลิก
                      </TableHead>
                      <TableHead
                        className="text-xs font-semibold"
                        style={{ color: "var(--color-muted)" }}
                      >
                        สถานะ
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map((contact) => {
                      const cfg =
                        CONTACT_STATUS_CONFIG[contact.status] ?? CONTACT_STATUS_CONFIG.pending
                      const hasOpened = ["opened", "clicked"].includes(contact.status)
                      const hasClicked = contact.status === "clicked"

                      return (
                        <TableRow
                          key={contact.id}
                          className="hover:bg-[var(--color-canvas)] transition-colors"
                          style={{ borderColor: "var(--color-border)" }}
                        >
                          {/* Name / Email */}
                          <TableCell className="py-3">
                            {contact.leads ? (
                              <div>
                                <Link
                                  href={`/${workspaceId}/leads/${contact.leads.id}`}
                                  className="block text-sm font-medium hover:underline"
                                  style={{ color: "var(--color-ink)" }}
                                >
                                  {contact.leads.name}
                                </Link>
                                <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                                  {contact.leads.email ?? "—"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                                —
                              </span>
                            )}
                          </TableCell>

                          {/* Sent at */}
                          <TableCell className="py-3">
                            <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                              {contact.sent_at ? formatThaiDateTime(contact.sent_at) : "—"}
                            </span>
                          </TableCell>

                          {/* Open count */}
                          <TableCell className="py-3 text-center">
                            <span
                              className="text-sm font-medium"
                              style={{
                                color: hasOpened ? "var(--color-success)" : "var(--color-muted)",
                              }}
                            >
                              {hasOpened ? "1" : "—"}
                            </span>
                          </TableCell>

                          {/* Click count */}
                          <TableCell className="py-3 text-center">
                            <span
                              className="text-sm font-medium"
                              style={{
                                color: hasClicked ? "#2563EB" : "var(--color-muted)",
                              }}
                            >
                              {hasClicked ? "1" : "—"}
                            </span>
                          </TableCell>

                          {/* Status badge */}
                          <TableCell className="py-3">
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
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}

              {/* Pagination */}
              {contactsTotalPages > 1 && (
                <div
                  className="flex items-center justify-between border-t px-5 py-3"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                    แสดง {(contactsPage - 1) * 20 + 1}–
                    {Math.min(contactsPage * 20, contactsTotal)} จาก{" "}
                    {contactsTotal.toLocaleString()} รายการ
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      style={{ borderRadius: "var(--radius-sm)" }}
                      disabled={contactsPage <= 1}
                      onClick={() => setContactsPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs font-medium" style={{ color: "var(--color-ink)" }}>
                      {contactsPage} / {contactsTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      style={{ borderRadius: "var(--radius-sm)" }}
                      disabled={contactsPage >= contactsTotalPages}
                      onClick={() => setContactsPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right sidebar ──────────────────────────────────── */}
          <div className="w-72 shrink-0 space-y-4">

            {/* ข้อมูลแคมเปญ */}
            <SidebarCard title="ข้อมูลแคมเปญ">
              <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                <SidebarRow label="Workspace">
                  <span style={{ color: "var(--color-ink)" }}>—</span>
                </SidebarRow>
                <SidebarRow label="หมวดหมู่">
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: "var(--color-primary-light)",
                      color: "var(--color-primary)",
                      borderRadius: "var(--radius-badge)",
                    }}
                  >
                    —
                  </span>
                </SidebarRow>
                <SidebarRow label="เทมเพลต">
                  {campaign.email_templates?.name ?? "—"}
                </SidebarRow>
                <SidebarRow label="ส่งจาก">
                  {campaign.sending_domains
                    ? `outreach@${campaign.sending_domains.domain}`
                    : "—"}
                </SidebarRow>
                <SidebarRow label="ตั้งเวลาส่ง">
                  วันจันทร์–ศุกร์ · 09:00–17:00
                </SidebarRow>
              </div>
            </SidebarCard>

            {/* ตัวอย่างอีเมล */}
            {campaign.email_templates && (
              <SidebarCard title="ตัวอย่างอีเมล">
                {/* Header row */}
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                    Subject
                  </span>
                  <button
                    className="flex items-center gap-1 text-xs hover:underline"
                    style={{ color: "var(--color-primary)" }}
                    onClick={() =>
                      toast.info("ไปยัง Email Template Editor")
                    }
                  >
                    <Pencil className="h-3 w-3" />
                    แก้ไข
                  </button>
                </div>

                {/* Subject */}
                <p
                  className="mb-3 rounded-lg px-3 py-2 text-xs font-medium leading-relaxed"
                  style={{
                    backgroundColor: "var(--color-canvas)",
                    color: "var(--color-ink)",
                    borderRadius: "var(--radius-input)",
                  }}
                >
                  {campaign.email_templates.subject || "—"}
                </p>

                {/* Body preview */}
                {campaign.email_templates.body && (
                  <p
                    className="text-xs leading-relaxed line-clamp-4"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {campaign.email_templates.body}
                  </p>
                )}

                <button
                  className="mt-2 text-xs hover:underline"
                  style={{ color: "var(--color-primary)" }}
                  onClick={() => toast.info("ดูเนื้อหาอีเมลเต็ม")}
                >
                  ดูเต็ม →
                </button>
              </SidebarCard>
            )}

            {/* กำหนดการส่ง */}
            <SidebarCard title="กำหนดการส่ง">
              <div className="space-y-3">
                {/* จำกัดต่อวัน */}
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                    จำกัดต่อวัน
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>
                    {dailyLimit} อีเมล/วัน
                  </span>
                </div>

                {/* ส่งวันนี้ */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                      ส่งวันนี้
                    </span>
                    <span className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>
                      {sentToday} / {dailyLimit}
                    </span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full"
                    style={{ backgroundColor: "var(--color-subtle)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${sentTodayPct}%`,
                        backgroundColor: "#2563EB",
                      }}
                    />
                  </div>
                </div>

                {/* ส่งต่อไป */}
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                    ส่งต่อไป
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>
                    {campaign.status === "completed"
                      ? "ส่งครบแล้ว"
                      : campaign.status === "paused"
                        ? "หยุดชั่วคราว"
                        : "พรุ่งนี้ 09:00"}
                  </span>
                </div>
              </div>
            </SidebarCard>

            {/* Quick stats (reply) */}
            <div
              className="rounded-xl border bg-white px-5 py-4"
              style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
            >
              <p className="mb-3 text-xs font-semibold" style={{ color: "var(--color-ink)" }}>
                สรุปภาพรวม
              </p>
              <div className="space-y-2">
                {[
                  {
                    icon: Send,
                    label: "ส่งสำเร็จ",
                    value: totalDelivered.toLocaleString(),
                    color: "var(--color-muted)",
                  },
                  {
                    icon: MailOpen,
                    label: "เปิดอ่าน",
                    value: (stats.opened + stats.clicked).toLocaleString(),
                    color: "var(--color-success)",
                  },
                  {
                    icon: MousePointerClick,
                    label: "คลิก",
                    value: stats.clicked.toLocaleString(),
                    color: "#2563EB",
                  },
                  {
                    icon: MessageSquare,
                    label: "ตอบกลับ",
                    value: String(replyCount),
                    color: "#7C3AED",
                  },
                  {
                    icon: AlertTriangle,
                    label: "Bounced",
                    value: stats.bounced.toLocaleString(),
                    color: "var(--color-danger)",
                  },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" style={{ color }} />
                      <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                        {label}
                      </span>
                    </div>
                    <span className="text-xs font-semibold" style={{ color }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
