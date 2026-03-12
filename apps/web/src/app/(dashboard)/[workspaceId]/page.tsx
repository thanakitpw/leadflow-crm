"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  Users,
  Mail,
  Megaphone,
  Send,
  TrendingUp,
  MousePointerClick,
  Search,
  Plus,
  FileText,
  Settings,
  UserPlus,
  Sparkles,
  GitBranch,
  BarChart3,
  Clock,
} from "lucide-react"
import { trpc } from "@/lib/trpc/client"

// ============================================================
// Types
// ============================================================

interface DashboardStats {
  leads: { total: number; withEmail: number; withoutEmail: number; emailCoverageRate: number }
  campaigns: { total: number; active: number; completed: number }
  emails: { sent: number; delivered: number; opened: number; clicked: number; bounced: number; openRate: number; clickRate: number; bounceRate: number }
}

interface ActivityItem {
  id: string
  action: string
  resource_type: string
  resource_name: string | null
  occurred_at: string
  metadata: Record<string, unknown> | null
}

// ============================================================
// Helpers
// ============================================================

function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)
  if (diffMin < 1) return "เมื่อกี้"
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`
  if (diffHr < 24) return `${diffHr} ชั่วโมงที่แล้ว`
  if (diffDay < 7) return `${diffDay} วันที่แล้ว`
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short" })
}

function getActivityIcon(action: string, resourceType: string): React.ElementType {
  if (resourceType === "lead") {
    if (action === "created") return UserPlus
    if (action === "scored") return Sparkles
    return TrendingUp
  }
  if (resourceType === "campaign") {
    if (action === "sent") return Send
    return Megaphone
  }
  if (resourceType === "sequence_enrollment") return GitBranch
  if (resourceType === "email_event") return Mail
  return TrendingUp
}

function getActivityColor(action: string, resourceType: string): string {
  if (resourceType === "lead" && action === "created") return "var(--color-success)"
  if (resourceType === "lead" && action === "scored") return "var(--color-ai)"
  if (resourceType === "campaign") return "var(--color-primary)"
  if (resourceType === "sequence_enrollment") return "var(--color-warning)"
  if (resourceType === "email_event") return "var(--color-info)"
  return "var(--color-muted)"
}

function getActivityBg(action: string, resourceType: string): string {
  if (resourceType === "lead" && action === "created") return "#F0FDF4"
  if (resourceType === "lead" && action === "scored") return "#EDE9FE"
  if (resourceType === "campaign") return "var(--color-primary-light)"
  if (resourceType === "sequence_enrollment") return "#FEF3C7"
  if (resourceType === "email_event") return "#DBEAFE"
  return "var(--color-subtle)"
}

function buildActivityMessage(item: ActivityItem): string {
  const name = item.resource_name ?? ""
  switch (`${item.resource_type}:${item.action}`) {
    case "lead:created": return `เพิ่ม lead "${name}" ใหม่`
    case "lead:updated": return `อัพเดทข้อมูล "${name}"`
    case "lead:scored": return `AI ให้คะแนน "${name}"`
    case "lead:deleted": return `ลบ lead "${name}"`
    case "campaign:created": return `สร้าง campaign "${name}"`
    case "campaign:sent": return `ส่ง campaign "${name}" แล้ว`
    case "campaign:completed": return `campaign "${name}" เสร็จสิ้น`
    case "sequence_enrollment:created": return `Enroll lead เข้า sequence "${name}"`
    default: return `${item.action} ${name}`.trim()
  }
}

// ============================================================
// Sub-components
// ============================================================

function StatCardSkeleton() {
  return (
    <div
      className="rounded-xl border bg-white p-5 animate-pulse"
      style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-3 w-20 rounded bg-gray-200 mb-2" />
          <div className="h-8 w-16 rounded bg-gray-200 mb-1" />
          <div className="h-3 w-14 rounded bg-gray-100" />
        </div>
        <div className="h-9 w-9 rounded-lg bg-gray-100" />
      </div>
    </div>
  )
}

function ActivitySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-start gap-3 animate-pulse">
          <div className="h-8 w-8 rounded-lg bg-gray-100 shrink-0" />
          <div className="flex-1 pt-1">
            <div className="h-3 w-3/4 rounded bg-gray-200 mb-1.5" />
            <div className="h-2.5 w-20 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function WorkspaceDashboardPage() {
  const params = useParams()
  const workspaceId = params.workspaceId as string

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [activity, setActivity] = useState<ActivityItem[] | null>(null)
  const [activityLoading, setActivityLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const result = await trpc.dashboard.getStats.query({ workspaceId })
      setStats(result as DashboardStats)
    } catch {
      // silently fail — dashboard stats are non-critical
    } finally {
      setStatsLoading(false)
    }
  }, [workspaceId])

  const fetchActivity = useCallback(async () => {
    setActivityLoading(true)
    try {
      const result = await trpc.dashboard.getRecentActivity.query({ workspaceId })
      setActivity(result as ActivityItem[])
    } catch {
      setActivity([])
    } finally {
      setActivityLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    fetchStats()
    fetchActivity()
  }, [fetchStats, fetchActivity])

  const statCards = [
    {
      label: "Leads ทั้งหมด",
      value: stats?.leads?.total ?? 0,
      sub: "leads ในระบบ",
      icon: Users,
      color: "var(--color-primary)",
      bg: "var(--color-primary-light)",
    },
    {
      label: "มีอีเมล",
      value: stats?.leads?.withEmail ?? 0,
      sub: "leads ที่มีอีเมล",
      icon: Mail,
      color: "var(--color-success)",
      bg: "#F0FDF4",
    },
    {
      label: "Campaigns",
      value: stats?.campaigns?.total ?? 0,
      sub: "แคมเปญทั้งหมด",
      icon: Megaphone,
      color: "var(--color-warning)",
      bg: "#FEF3C7",
    },
    {
      label: "อีเมลส่งแล้ว",
      value: stats?.emails?.sent ?? 0,
      sub: "ทั้งหมด",
      icon: Send,
      color: "var(--color-info)",
      bg: "#DBEAFE",
    },
    {
      label: "Open Rate",
      value: stats?.emails?.openRate != null ? `${stats.emails.openRate}%` : "—",
      sub: "อัตราเปิดอีเมล",
      icon: TrendingUp,
      color: "#16A34A",
      bg: "#F0FDF4",
    },
    {
      label: "Click Rate",
      value: stats?.emails?.clickRate != null ? `${stats.emails.clickRate}%` : "—",
      sub: "อัตราคลิก",
      icon: MousePointerClick,
      color: "var(--color-ai)",
      bg: "#EDE9FE",
    },
  ]

  const quickActions = [
    {
      label: "ค้นหา Leads",
      icon: Search,
      href: `/${workspaceId}/leads/search`,
      color: "var(--color-primary)",
      bg: "var(--color-primary-light)",
    },
    {
      label: "สร้าง Campaign",
      icon: Plus,
      href: `/${workspaceId}/campaigns/create`,
      color: "var(--color-warning)",
      bg: "#FEF3C7",
    },
    {
      label: "สร้าง Template",
      icon: FileText,
      href: `/${workspaceId}/templates/create`,
      color: "var(--color-info)",
      bg: "#DBEAFE",
    },
    {
      label: "ตั้งค่า Domain",
      icon: Settings,
      href: `/${workspaceId}/settings/domains`,
      color: "var(--color-muted)",
      bg: "var(--color-subtle)",
    },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-canvas)" }}>
      <div className="px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
              Dashboard
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
              ภาพรวมของ workspace และกิจกรรมล่าสุด
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-muted)" }}>
            <Clock className="h-3.5 w-3.5" />
            <span>
              {new Date().toLocaleDateString("th-TH", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {statsLoading
            ? Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
            : statCards.map(({ label, value, sub, icon: Icon, color, bg }) => (
                <div
                  key={label}
                  className="rounded-xl border bg-white p-5"
                  style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: "var(--color-muted)" }}>
                        {label}
                      </p>
                      <p className="mt-1 text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
                        {value}
                      </p>
                      {sub && (
                        <p className="mt-0.5 text-xs truncate" style={{ color: "var(--color-muted)" }}>
                          {sub}
                        </p>
                      )}
                    </div>
                    <div
                      className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: bg }}
                    >
                      <Icon className="h-4 w-4" style={{ color }} />
                    </div>
                  </div>
                </div>
              ))}
        </div>

        {/* Content: Activity + Quick Actions */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <div
              className="rounded-xl border bg-white"
              style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
            >
              <div
                className="flex items-center justify-between border-b px-5 py-4"
                style={{ borderColor: "var(--color-border)" }}
              >
                <h2 className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                  กิจกรรมล่าสุด
                </h2>
                <Link
                  href={`/${workspaceId}/leads`}
                  className="text-xs font-medium hover:underline"
                  style={{ color: "var(--color-primary)" }}
                >
                  ดูทั้งหมด
                </Link>
              </div>

              <div className="p-5">
                {activityLoading ? (
                  <ActivitySkeleton />
                ) : !activity || activity.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-10">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-full"
                      style={{ backgroundColor: "var(--color-primary-light)" }}
                    >
                      <TrendingUp className="h-6 w-6" style={{ color: "var(--color-primary)" }} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                      ยังไม่มีกิจกรรม
                    </p>
                    <p className="text-xs text-center" style={{ color: "var(--color-muted)" }}>
                      เริ่มต้นด้วยการค้นหา leads หรือสร้าง campaign แรก
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activity.map((item) => {
                      const Icon = getActivityIcon(item.action, item.resource_type)
                      const iconColor = getActivityColor(item.action, item.resource_type)
                      const iconBg = getActivityBg(item.action, item.resource_type)
                      return (
                        <div key={item.id} className="flex items-start gap-3">
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: iconBg }}
                          >
                            <Icon className="h-3.5 w-3.5" style={{ color: iconColor }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm leading-snug" style={{ color: "var(--color-ink)" }}>
                              {buildActivityMessage(item)}
                            </p>
                            <p className="mt-0.5 text-xs" style={{ color: "var(--color-muted)" }}>
                              {formatRelativeTime(item.occurred_at)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions + Reports */}
          <div>
            <div
              className="rounded-xl border bg-white"
              style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
            >
              <div
                className="border-b px-5 py-4"
                style={{ borderColor: "var(--color-border)" }}
              >
                <h2 className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                  Quick Actions
                </h2>
              </div>
              <div className="p-5 space-y-2">
                {quickActions.map(({ label, icon: Icon, href, color, bg }) => (
                  <Link key={href} href={href}>
                    <div
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-opacity hover:opacity-70"
                      style={{
                        backgroundColor: bg,
                        borderRadius: "var(--radius-btn)",
                      }}
                    >
                      <Icon className="h-4 w-4 shrink-0" style={{ color }} />
                      <span className="text-sm font-medium" style={{ color }}>
                        {label}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Reports shortcut */}
            <Link href={`/${workspaceId}/reports`} className="block mt-4">
              <div
                className="rounded-xl border bg-white p-4 flex items-center gap-3 hover:shadow-sm transition-shadow"
                style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "#F0FDF4" }}
                >
                  <BarChart3 className="h-4 w-4" style={{ color: "var(--color-success)" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                    รายงาน
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                    สร้างและแชร์รายงานให้ลูกค้า
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
