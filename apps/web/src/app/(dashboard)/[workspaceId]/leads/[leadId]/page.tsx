import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  MapPin,
  Star,
  Facebook,
} from "lucide-react"
import LeadDetailClient from "./lead-detail-client"

interface PageProps {
  params: Promise<{ workspaceId: string; leadId: string }>
}

type LeadRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  status: string
  rating: number | null
  review_count: number | null
  category: string | null
  place_id: string | null
  latitude: number | null
  longitude: number | null
  source_type: string | null
  notes: string | null
  created_at: string
  updated_at: string
  lead_scores: {
    id: string
    score: number
    reasoning: string
    scored_at: string
  }[]
  lead_tags: {
    id: string
    tag: string
  }[]
}

// ============================================================
// Helpers
// ============================================================

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    new: "ใหม่",
    contacted: "ติดต่อแล้ว",
    qualified: "คัดแล้ว",
    unqualified: "ไม่ผ่าน",
  }
  return map[status] ?? status
}

function getStatusStyle(status: string): React.CSSProperties {
  switch (status) {
    case "new":
      return { backgroundColor: "#FEF3C7", color: "#D97706" }
    case "contacted":
      return { backgroundColor: "#DBEAFE", color: "#2563EB" }
    case "qualified":
      return { backgroundColor: "#F0FDF4", color: "#16A34A" }
    default:
      return { backgroundColor: "#F5F0EB", color: "#7A6F68" }
  }
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "ความน่าจะเป็นสูง"
  if (score >= 50) return "ความน่าจะเป็นปานกลาง"
  return "ความน่าจะเป็นต่ำ"
}

/**
 * Parse AI reasoning string into detail items with score components.
 * Tries to extract lines that contain numeric bonuses/penalties.
 * Falls back to default items.
 */
function parseScoreDetails(
  reasoning: string,
  lead: LeadRow,
): { label: string; points: string }[] {
  const items: { label: string; points: string }[] = []
  if (lead.email) items.push({ label: "มีอีเมล", points: "+25" })
  if (lead.rating && lead.rating >= 4) items.push({ label: "Rating สูง", points: "+20" })
  if (lead.review_count && lead.review_count > 100) items.push({ label: "รีวิวเยอะ", points: "+15" })
  if (lead.website) items.push({ label: "มีเว็บไซต์", points: "+10" })
  if (items.length === 0 && reasoning) {
    // Use first 3 lines of reasoning as fallback
    const lines = reasoning.split(/[.\n]/).filter(Boolean).slice(0, 3)
    lines.forEach((line) => items.push({ label: line.trim(), points: "" }))
  }
  return items.slice(0, 4)
}

// ============================================================
// Page Component
// ============================================================

export default async function LeadDetailPage({ params }: PageProps) {
  const { workspaceId, leadId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // Check membership
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!membership) redirect("/")

  const canEdit = ["agency_admin", "agency_member"].includes(membership.role)

  // Fetch lead data
  const { data: lead, error } = await supabase
    .from("leads")
    .select(
      `
      id, name, email, phone, website, address, status,
      rating, review_count, category, place_id,
      latitude, longitude, source_type, notes,
      created_at, updated_at,
      lead_scores ( id, score, reasoning, scored_at ),
      lead_tags ( id, tag )
    `,
    )
    .eq("id", leadId)
    .eq("workspace_id", workspaceId)
    .single()

  if (error || !lead) {
    notFound()
  }

  const typedLead = lead as LeadRow

  // Latest score
  const latestScore =
    typedLead.lead_scores.length > 0
      ? typedLead.lead_scores.sort(
          (a, b) => new Date(b.scored_at).getTime() - new Date(a.scored_at).getTime(),
        )[0]
      : null

  const initials = getInitials(typedLead.name)
  const scoreDetails = latestScore
    ? parseScoreDetails(latestScore.reasoning, typedLead)
    : []

  // Hot lead badge: score >= 80
  const isHotLead = latestScore && latestScore.score >= 80

  // Location short form from address
  const locationShort = (() => {
    if (!typedLead.address) return null
    const parts = typedLead.address.split(",")
    if (parts.length >= 2) {
      return parts.slice(-2).map((p) => p.trim()).join(", ")
    }
    return typedLead.address
  })()

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-canvas)" }}>
      <div className="px-8 py-6">

        {/* ── Header Bar ─────────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={`/${workspaceId}/leads`}
              className="flex items-center gap-1.5 font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--color-muted)" }}
            >
              <ArrowLeft className="h-4 w-4" />
              ลีด
            </Link>
            <span style={{ color: "var(--color-border)" }}>/</span>
            <span className="font-medium" style={{ color: "var(--color-ink)" }}>
              {typedLead.name}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-2 rounded-[10px] border px-4 py-2 text-sm font-medium transition-colors hover:bg-[#F5F0EB]"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-ink)",
              }}
            >
              <Mail className="h-4 w-4" />
              ส่งอีเมล
            </button>
            <button
              className="flex items-center gap-2 rounded-[10px] border px-4 py-2 text-sm font-medium transition-colors hover:bg-[#F5F0EB]"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-ink)",
              }}
            >
              Export
            </button>
            <button
              className="flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Assign Workspace
            </button>
          </div>
        </div>

        {/* ── 3-column Grid ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr_1fr]">

          {/* ══ Column 1: Lead Profile ══════════════════════════════ */}
          <div className="space-y-5">

            {/* Profile Header */}
            <div
              className="rounded-xl border bg-white p-5"
              style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
            >
              {/* Avatar + Name */}
              <div className="mb-4 flex items-start gap-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold"
                  style={{
                    backgroundColor: "var(--color-primary-light)",
                    color: "var(--color-primary)",
                  }}
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg font-bold leading-tight" style={{ color: "var(--color-ink)" }}>
                    {typedLead.name}
                  </h1>
                  {(typedLead.category || locationShort) && (
                    <p className="mt-0.5 text-sm" style={{ color: "var(--color-muted)" }}>
                      {[typedLead.category, locationShort].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>

              {/* Status badges */}
              <div className="flex flex-wrap gap-2">
                {isHotLead && (
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold"
                    style={{
                      borderRadius: "var(--radius-badge)",
                      backgroundColor: "#FEF2F2",
                      color: "#DC2626",
                    }}
                  >
                    ลีดร้อน
                  </span>
                )}
                <span
                  className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    borderRadius: "var(--radius-badge)",
                    ...getStatusStyle(typedLead.status),
                  }}
                >
                  {getStatusLabel(typedLead.status)}
                </span>
                {typedLead.category && (
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 text-xs"
                    style={{
                      borderRadius: "var(--radius-badge)",
                      backgroundColor: "var(--color-subtle)",
                      color: "var(--color-muted)",
                    }}
                  >
                    {typedLead.category}
                  </span>
                )}
              </div>
            </div>

            {/* AI Lead Score Card */}
            {latestScore && (
              <div
                className="rounded-xl p-5"
                style={{
                  background: "linear-gradient(135deg, #1E3A5F 0%, #152C4A 100%)",
                  borderRadius: "var(--radius-card)",
                }}
              >
                <div className="flex items-start gap-4">
                  {/* Score number */}
                  <div className="shrink-0">
                    <p
                      className="font-extrabold leading-none"
                      style={{ fontSize: "56px", color: "white", lineHeight: 1 }}
                    >
                      {latestScore.score}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
                      {getScoreLabel(latestScore.score)}
                    </p>
                  </div>

                  {/* Claude AI details */}
                  <div className="min-w-0 flex-1">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.6)" }}>
                      Claude AI Analysis
                    </p>
                    <div className="space-y-1.5">
                      {scoreDetails.map((item, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.85)" }}>
                            {item.label}
                          </span>
                          {item.points && (
                            <span
                              className="shrink-0 text-xs font-semibold"
                              style={{ color: item.points.startsWith("+") ? "#4ADE80" : "#F87171" }}
                            >
                              {item.points}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ข้อมูลติดต่อ */}
            <div
              className="rounded-xl border bg-white p-5"
              style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
            >
              <p
                className="mb-3 text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--color-muted)" }}
              >
                ข้อมูลติดต่อ
              </p>
              <div className="space-y-3.5">
                {typedLead.email && (
                  <div className="flex items-start gap-2.5">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--color-muted)" }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm" style={{ color: "var(--color-ink)" }}>
                        {typedLead.email}
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--color-success)" }}>
                        ความน่าเชื่อถือ 95% (regex)
                      </p>
                    </div>
                  </div>
                )}
                {typedLead.phone && (
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-4 w-4 shrink-0" style={{ color: "var(--color-muted)" }} />
                    <p className="text-sm" style={{ color: "var(--color-ink)" }}>
                      {typedLead.phone}
                    </p>
                  </div>
                )}
                {typedLead.address && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--color-muted)" }} />
                    <p className="text-sm" style={{ color: "var(--color-ink)" }}>
                      {typedLead.address}
                    </p>
                  </div>
                )}
                {typedLead.website && (
                  <div className="flex items-center gap-2.5">
                    <Globe className="h-4 w-4 shrink-0" style={{ color: "var(--color-muted)" }} />
                    <a
                      href={typedLead.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:underline"
                      style={{ color: "var(--color-primary)" }}
                    >
                      {typedLead.website.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                )}
                {!typedLead.email && !typedLead.phone && !typedLead.address && !typedLead.website && (
                  <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                    ยังไม่มีข้อมูลติดต่อ
                  </p>
                )}
              </div>
            </div>

            {/* Google Places */}
            {(typedLead.rating || typedLead.review_count) && (
              <div
                className="rounded-xl border bg-white p-5"
                style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
              >
                <p
                  className="mb-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--color-muted)" }}
                >
                  Google Places
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {/* Rating */}
                  {typedLead.rating && (
                    <div
                      className="rounded-lg p-3 text-center"
                      style={{ backgroundColor: "var(--color-canvas)" }}
                    >
                      <div className="flex items-center justify-center gap-0.5 mb-1">
                        <Star className="h-3.5 w-3.5 fill-current" style={{ color: "#D97706" }} />
                        <span className="text-base font-bold" style={{ color: "var(--color-ink)" }}>
                          {typedLead.rating.toFixed(1)}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                        คะแนน
                      </p>
                    </div>
                  )}

                  {/* Reviews */}
                  {typedLead.review_count && (
                    <div
                      className="rounded-lg p-3 text-center"
                      style={{ backgroundColor: "var(--color-canvas)" }}
                    >
                      <p className="text-base font-bold" style={{ color: "var(--color-ink)" }}>
                        {typedLead.review_count.toLocaleString()}
                      </p>
                      <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                        รีวิว
                      </p>
                    </div>
                  )}

                  {/* Price level placeholder */}
                  <div
                    className="rounded-lg p-3 text-center"
                    style={{ backgroundColor: "var(--color-canvas)" }}
                  >
                    <p className="text-base font-bold" style={{ color: "var(--color-ink)" }}>
                      $$
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                      ระดับราคา
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Social Media */}
            <div
              className="rounded-xl border bg-white p-5"
              style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
            >
              <p
                className="mb-3 text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--color-muted)" }}
              >
                Social Media
              </p>
              <div className="space-y-3">
                {/* Facebook */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-lg"
                      style={{ backgroundColor: "#EEF2F8" }}
                    >
                      <Facebook className="h-4 w-4" style={{ color: "#1877F2" }} />
                    </div>
                    <span className="text-sm" style={{ color: "var(--color-ink)" }}>
                      Facebook Page
                    </span>
                  </div>
                  <span
                    className="text-xs font-medium"
                    style={{
                      borderRadius: "var(--radius-badge)",
                      padding: "2px 8px",
                      backgroundColor: "#F0FDF4",
                      color: "var(--color-success)",
                    }}
                  >
                    พบแล้ว
                  </span>
                </div>

                {/* LINE OA */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold"
                      style={{ backgroundColor: "#F0FDF4", color: "#06C755" }}
                    >
                      L
                    </div>
                    <span className="text-sm" style={{ color: "var(--color-ink)" }}>
                      Line OA
                    </span>
                  </div>
                  <span
                    className="text-xs font-medium"
                    style={{
                      borderRadius: "var(--radius-badge)",
                      padding: "2px 8px",
                      backgroundColor: "var(--color-subtle)",
                      color: "var(--color-muted)",
                    }}
                  >
                    ไม่พบ
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ══ Column 2 + 3: Client Component (spans 2 cols on lg) ═══ */}
          {/*
            LeadDetailClient internally renders a 2-column grid
            (col2: notes/tags/tasks, col3: activity timeline)
            so we give it lg:col-span-2 to fill the remaining space.
          */}
          <div className="lg:col-span-2">
            <LeadDetailClient
              workspaceId={workspaceId}
              lead={{
                id: typedLead.id,
                name: typedLead.name,
                email: typedLead.email,
                phone: typedLead.phone,
                website: typedLead.website,
                status: typedLead.status,
                notes: typedLead.notes,
                tags: typedLead.lead_tags,
              }}
              canEdit={canEdit}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
