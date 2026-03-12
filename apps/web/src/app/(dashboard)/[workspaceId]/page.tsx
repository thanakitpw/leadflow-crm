import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  Users,
  Megaphone,
  Mail,
  TrendingUp,
  ArrowRight,
  Sparkles,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { getRoleLabel } from "@/lib/permissions"

interface PageProps {
  params: Promise<{ workspaceId: string }>
}

export default async function WorkspaceDashboardPage({ params }: PageProps) {
  const { workspaceId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // ดึง workspace + membership
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!membership) redirect("/")

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, type, created_at")
    .eq("id", workspaceId)
    .single()

  if (!workspace) redirect("/")

  // นับจำนวน members
  const { count: memberCount } = await supabase
    .from("workspace_members")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)

  const userMeta = user.user_metadata as { full_name?: string } | undefined
  const displayName = userMeta?.full_name ?? "คุณ"

  const typeLabel: Record<string, string> = {
    agency: "Agency",
    client: "Client",
  }

  // Placeholder stats cards
  const stats = [
    {
      label: "Leads ทั้งหมด",
      value: "—",
      sub: "Phase 2",
      icon: TrendingUp,
      color: "var(--color-primary)",
      bg: "var(--color-primary-light)",
    },
    {
      label: "สมาชิก",
      value: memberCount ?? 0,
      sub: "คนในทีม",
      icon: Users,
      color: "var(--color-success)",
      bg: "#DCFCE7",
    },
    {
      label: "Campaigns",
      value: "—",
      sub: "Phase 3",
      icon: Megaphone,
      color: "var(--color-warning)",
      bg: "#FEF3C7",
    },
    {
      label: "อีเมลส่งแล้ว",
      value: "—",
      sub: "Phase 3",
      icon: Mail,
      color: "var(--color-info)",
      bg: "#DBEAFE",
    },
  ]

  // Phase 2+ feature cards
  const featureCards = [
    {
      title: "Lead Generation",
      description: "ค้นหา leads จาก Google Places + AI enrichment + scoring",
      href: `/${workspaceId}/leads`,
      icon: TrendingUp,
      badge: "Phase 2",
      badgeColor: "var(--color-primary)",
      badgeBg: "var(--color-primary-light)",
    },
    {
      title: "Email Campaigns",
      description: "สร้าง campaign ส่งอีเมล bulk + track open/click rate",
      href: `/${workspaceId}/campaigns`,
      icon: Megaphone,
      badge: "Phase 3",
      badgeColor: "var(--color-warning)",
      badgeBg: "#FEF3C7",
    },
    {
      title: "Email Sequences",
      description: "Drip sequence อัตโนมัติ ส่งตาม logic และ behavior",
      href: `/${workspaceId}/email`,
      icon: Mail,
      badge: "Phase 3",
      badgeColor: "var(--color-info)",
      badgeBg: "#DBEAFE",
    },
    {
      title: "AI Lead Scoring",
      description: "Claude วิเคราะห์และให้คะแนน lead อัตโนมัติ 0–100",
      href: `/${workspaceId}/leads`,
      icon: Sparkles,
      badge: "AI",
      badgeColor: "var(--color-ai)",
      badgeBg: "#EDE9FE",
    },
  ]

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <p className="mb-1 text-sm" style={{ color: "var(--color-muted)" }}>
          สวัสดี, {displayName}
        </p>
        <div className="flex items-center gap-3">
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--color-ink)" }}
          >
            {workspace.name}
          </h1>
          <span
            className="rounded px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: "var(--color-primary-light)",
              color: "var(--color-primary)",
              borderRadius: "var(--radius-badge)",
            }}
          >
            {typeLabel[workspace.type] ?? workspace.type}
          </span>
          <span
            className="rounded px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: "#F0FDF4",
              color: "var(--color-success)",
              borderRadius: "var(--radius-badge)",
            }}
          >
            {getRoleLabel(membership.role)}
          </span>
        </div>
        <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
          ยินดีต้อนรับสู่ LeadFlow CRM — ระบบพร้อมใช้งาน
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <Card
            key={label}
            className="p-5"
            style={{
              borderRadius: "var(--radius-card)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p
                  className="text-xs font-medium"
                  style={{ color: "var(--color-muted)" }}
                >
                  {label}
                </p>
                <p
                  className="mt-1 text-2xl font-bold"
                  style={{ color: "var(--color-ink)" }}
                >
                  {value}
                </p>
                <p
                  className="mt-0.5 text-xs"
                  style={{ color: "var(--color-muted)" }}
                >
                  {sub}
                </p>
              </div>
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: bg }}
              >
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Feature Cards */}
      <div className="mb-4 flex items-center justify-between">
        <h2
          className="text-base font-semibold"
          style={{ color: "var(--color-ink)" }}
        >
          ฟีเจอร์ทั้งหมด
        </h2>
        <p className="text-xs" style={{ color: "var(--color-muted)" }}>
          กำลังพัฒนาตามแผน Roadmap
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {featureCards.map(
          ({
            title,
            description,
            href,
            icon: Icon,
            badge,
            badgeColor,
            badgeBg,
          }) => (
            <Link key={title} href={href}>
              <Card
                className="group cursor-pointer border-border p-5 transition-all hover:border-primary/30 hover:shadow-sm"
                style={{ borderRadius: "var(--radius-card)" }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: badgeBg }}
                    >
                      <Icon className="h-4 w-4" style={{ color: badgeColor }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3
                          className="text-sm font-semibold"
                          style={{ color: "var(--color-ink)" }}
                        >
                          {title}
                        </h3>
                        <span
                          className="rounded px-1.5 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: badgeBg,
                            color: badgeColor,
                            borderRadius: "var(--radius-badge)",
                          }}
                        >
                          {badge}
                        </span>
                      </div>
                      <p
                        className="mt-1 text-xs leading-relaxed"
                        style={{ color: "var(--color-muted)" }}
                      >
                        {description}
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                    style={{ color: "var(--color-muted)" }}
                  />
                </div>
              </Card>
            </Link>
          )
        )}
      </div>
    </div>
  )
}
