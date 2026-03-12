"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Send,
  MailOpen,
  MousePointerClick,
  AlertTriangle,
  Loader2,
  Pause,
  Play,
  XCircle,
  Mail,
  ChevronLeft,
  ChevronRight,
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
  email_templates: { id: string; name: string; subject: string } | null
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
  sending: { label: "กำลังส่ง", color: "#16A34A", bg: "#F0FDF4" },
  paused: { label: "หยุดชั่วคราว", color: "#D97706", bg: "#FEF3C7" },
  completed: { label: "เสร็จสิ้น", color: "#16A34A", bg: "#F0FDF4" },
  cancelled: { label: "ยกเลิก", color: "#DC2626", bg: "#FEF2F2" },
}

const CONTACT_STATUS_CONFIG: Record<ContactStatus, { label: string; color: string; bg: string }> = {
  pending: { label: "รอส่ง", color: "#7A6F68", bg: "#F5F0EB" },
  sent: { label: "ส่งแล้ว", color: "#2563EB", bg: "#DBEAFE" },
  opened: { label: "เปิดแล้ว", color: "#16A34A", bg: "#F0FDF4" },
  clicked: { label: "คลิกแล้ว", color: "#7C3AED", bg: "#F5F3FF" },
  bounced: { label: "Bounced", color: "#DC2626", bg: "#FEF2F2" },
  unsubscribed: { label: "Unsubscribed", color: "#7A6F68", bg: "#F5F0EB" },
}

function pct(num: number, den: number): string {
  if (den === 0) return "0%"
  return `${Math.round((num / den) * 100)}%`
}

function StatCard({
  label,
  value,
  sub,
  color,
  icon: Icon,
}: {
  label: string
  value: string | number
  sub?: string
  color: string
  icon: React.ElementType
}) {
  return (
    <div
      className="rounded-xl border bg-white p-5"
      style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
          {label}
        </p>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <p className="mt-2 text-2xl font-bold" style={{ color }}>
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs" style={{ color: "var(--color-muted)" }}>
          {sub}
        </p>
      )}
    </div>
  )
}

// ============================================================
// Component
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

  const statusCfg = STATUS_CONFIG[campaign.status]
  const { stats } = campaign
  const totalDelivered = stats.sent + stats.opened + stats.clicked

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-canvas)" }}>
      <div className="px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/${workspaceId}/campaigns`}>
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                กลับ
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
                  {campaign.name}
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
              {campaign.email_templates && (
                <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
                  Template: {campaign.email_templates.name}
                  {campaign.sending_domains && ` — ส่งจาก ${campaign.sending_domains.domain}`}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {campaign.status === "sending" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePause}
                className="gap-2"
                style={{ borderRadius: "var(--radius-btn)" }}
              >
                <Pause className="h-4 w-4" />
                หยุดชั่วคราว
              </Button>
            )}
            {campaign.status === "paused" && (
              <Button
                size="sm"
                onClick={() => toast.info("ฟีเจอร์ resume จะพร้อมเร็วๆ นี้")}
                className="gap-2"
                style={{
                  backgroundColor: "var(--color-primary)",
                  borderRadius: "var(--radius-btn)",
                }}
              >
                <Play className="h-4 w-4" />
                ส่งต่อ
              </Button>
            )}
            {["draft", "scheduled", "sending", "paused"].includes(campaign.status) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="gap-2"
                style={{
                  borderRadius: "var(--radius-btn)",
                  color: "var(--color-danger)",
                  borderColor: "var(--color-danger)",
                }}
              >
                <XCircle className="h-4 w-4" />
                ยกเลิก
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-6 grid grid-cols-4 gap-4">
          <StatCard
            label="ส่งแล้ว"
            value={totalDelivered.toLocaleString()}
            sub={`จาก ${stats.total.toLocaleString()} recipients`}
            color="var(--color-primary)"
            icon={Send}
          />
          <StatCard
            label="Open Rate"
            value={pct(stats.opened + stats.clicked, totalDelivered)}
            sub={`${(stats.opened + stats.clicked).toLocaleString()} คน`}
            color="#2563EB"
            icon={MailOpen}
          />
          <StatCard
            label="Click Rate"
            value={pct(stats.clicked, totalDelivered)}
            sub={`${stats.clicked.toLocaleString()} คน`}
            color="#7C3AED"
            icon={MousePointerClick}
          />
          <StatCard
            label="Bounced"
            value={pct(stats.bounced, totalDelivered)}
            sub={`${stats.bounced.toLocaleString()} อีเมล`}
            color="var(--color-danger)"
            icon={AlertTriangle}
          />
        </div>

        {/* Contacts Table */}
        <div
          className="rounded-xl border bg-white shadow-sm"
          style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
        >
          <div
            className="flex items-center justify-between border-b px-5 py-4"
            style={{ borderColor: "var(--color-border)" }}
          >
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
              รายการ Contacts ({contactsTotal.toLocaleString()})
            </h2>
          </div>

          {contactsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2
                className="h-5 w-5 animate-spin"
                style={{ color: "var(--color-primary)" }}
              />
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--color-primary-light)" }}
              >
                <Mail className="h-6 w-6" style={{ color: "var(--color-primary)" }} />
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                ยังไม่มี contacts ใน campaign นี้
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: "var(--color-border)" }}>
                  <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                    ชื่อ
                  </TableHead>
                  <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                    อีเมล
                  </TableHead>
                  <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                    สถานะ
                  </TableHead>
                  <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                    ส่งเมื่อ
                  </TableHead>
                  <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                    เปิดเมื่อ
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => {
                  const cfg =
                    CONTACT_STATUS_CONFIG[contact.status] ?? CONTACT_STATUS_CONFIG.pending
                  return (
                    <TableRow
                      key={contact.id}
                      style={{ borderColor: "var(--color-border)" }}
                    >
                      <TableCell>
                        {contact.leads ? (
                          <Link
                            href={`/${workspaceId}/leads/${contact.leads.id}`}
                            className="font-medium hover:underline"
                            style={{ color: "var(--color-ink)" }}
                          >
                            {contact.leads.name}
                          </Link>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm" style={{ color: "var(--color-muted)" }}>
                          {contact.leads?.email ?? "—"}
                        </span>
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
                        <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                          {contact.sent_at
                            ? new Date(contact.sent_at).toLocaleDateString("th-TH", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                          {contact.opened_at
                            ? new Date(contact.opened_at).toLocaleDateString("th-TH", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
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
                {Math.min(contactsPage * 20, contactsTotal)} จาก {contactsTotal} รายการ
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={contactsPage <= 1}
                  onClick={() => setContactsPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-medium" style={{ color: "var(--color-ink)" }}>
                  {contactsPage} / {contactsTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={contactsPage >= contactsTotalPages}
                  onClick={() => setContactsPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
