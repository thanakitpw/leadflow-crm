import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ChevronRight, MapPin, Globe, Phone, Mail, Tag } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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

export default async function LeadDetailPage({ params }: PageProps) {
  const { workspaceId, leadId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // ตรวจสอบ membership
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!membership) redirect("/")

  const canEdit = ["agency_admin", "agency_member"].includes(membership.role)

  // ดึงข้อมูล lead
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

  const STATUS_LABELS: Record<string, string> = {
    new: "ใหม่",
    contacted: "ติดต่อแล้ว",
    qualified: "คัดแล้ว",
    unqualified: "ไม่ผ่าน",
  }

  const mapsUrl = typedLead.latitude && typedLead.longitude
    ? `https://www.google.com/maps?q=${typedLead.latitude},${typedLead.longitude}`
    : typedLead.address
    ? `https://www.google.com/maps/search/${encodeURIComponent(typedLead.address)}`
    : null

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-canvas)" }}>
      <div className="mx-auto max-w-4xl px-8 py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm" style={{ color: "var(--color-muted)" }}>
          <Link href={`/${workspaceId}/leads`} className="hover:underline" style={{ color: "var(--color-muted)" }}>
            Leads
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span style={{ color: "var(--color-ink)" }}>{typedLead.name}</span>
        </div>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
                {typedLead.name}
              </h1>
              <span
                className="rounded px-2 py-0.5 text-xs font-medium"
                style={{
                  borderRadius: "var(--radius-badge)",
                  ...(typedLead.status === "new"
                    ? { backgroundColor: "#FEF3C7", color: "#D97706" }
                    : typedLead.status === "contacted"
                    ? { backgroundColor: "#DBEAFE", color: "#2563EB" }
                    : typedLead.status === "qualified"
                    ? { backgroundColor: "#F0FDF4", color: "#16A34A" }
                    : { backgroundColor: "#F5F0EB", color: "#7A6F68" }),
                }}
              >
                {STATUS_LABELS[typedLead.status] ?? typedLead.status}
              </span>
              {typedLead.category && (
                <span
                  className="rounded px-2 py-0.5 text-xs"
                  style={{
                    backgroundColor: "var(--color-subtle)",
                    color: "var(--color-muted)",
                    borderRadius: "var(--radius-badge)",
                  }}
                >
                  {typedLead.category}
                </span>
              )}
            </div>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              เพิ่มเมื่อ{" "}
              {new Date(typedLead.created_at).toLocaleDateString("th-TH", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-slate-50"
              style={{ borderColor: "var(--color-border)", color: "var(--color-muted)", borderRadius: "var(--radius-btn)" }}
            >
              <MapPin className="h-3.5 w-3.5" />
              Google Maps
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Left column: ข้อมูลธุรกิจ */}
          <div className="space-y-5 lg:col-span-2">
            {/* ข้อมูลธุรกิจ */}
            <div
              className="rounded-xl border bg-white p-5"
              style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
            >
              <h2 className="mb-4 text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                ข้อมูลธุรกิจ
              </h2>
              <div className="space-y-3">
                {typedLead.address && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--color-muted)" }} />
                    <div>
                      <p className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
                        ที่อยู่
                      </p>
                      <p className="mt-0.5 text-sm" style={{ color: "var(--color-ink)" }}>
                        {typedLead.address}
                      </p>
                    </div>
                  </div>
                )}
                {typedLead.phone && (
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-4 w-4 shrink-0" style={{ color: "var(--color-muted)" }} />
                    <div>
                      <p className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
                        เบอร์โทร
                      </p>
                      <p className="mt-0.5 text-sm" style={{ color: "var(--color-ink)" }}>
                        {typedLead.phone}
                      </p>
                    </div>
                  </div>
                )}
                {typedLead.website && (
                  <div className="flex items-center gap-2.5">
                    <Globe className="h-4 w-4 shrink-0" style={{ color: "var(--color-muted)" }} />
                    <div>
                      <p className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
                        เว็บไซต์
                      </p>
                      <a
                        href={typedLead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 block text-sm hover:underline"
                        style={{ color: "var(--color-primary)" }}
                      >
                        {typedLead.website.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  </div>
                )}
                {typedLead.email && (
                  <div className="flex items-center gap-2.5">
                    <Mail className="h-4 w-4 shrink-0" style={{ color: "var(--color-muted)" }} />
                    <div>
                      <p className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
                        อีเมล
                      </p>
                      <p className="mt-0.5 text-sm" style={{ color: "var(--color-ink)" }}>
                        {typedLead.email}
                      </p>
                    </div>
                  </div>
                )}
                {typedLead.rating && (
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">⭐</span>
                    <div>
                      <p className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
                        Rating
                      </p>
                      <p className="mt-0.5 text-sm" style={{ color: "var(--color-ink)" }}>
                        {typedLead.rating.toFixed(1)}{" "}
                        {typedLead.review_count ? `(${typedLead.review_count.toLocaleString()} รีวิว)` : ""}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* AI Score section */}
            <div
              className="rounded-xl border bg-white p-5"
              style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                  คะแนน AI
                </h2>
                {latestScore && (
                  <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                    วิเคราะห์เมื่อ{" "}
                    {new Date(latestScore.scored_at).toLocaleDateString("th-TH", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                )}
              </div>

              {latestScore ? (
                <div>
                  {/* Score display */}
                  <div className="mb-3 flex items-center gap-4">
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold"
                      style={{
                        backgroundColor:
                          latestScore.score >= 80 ? "#F0FDF4" : latestScore.score >= 50 ? "#FEF3C7" : "#FEF2F2",
                        color:
                          latestScore.score >= 80 ? "#16A34A" : latestScore.score >= 50 ? "#D97706" : "#DC2626",
                      }}
                    >
                      {latestScore.score}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                        {latestScore.score >= 80 ? "Lead คุณภาพสูง" : latestScore.score >= 50 ? "Lead ปานกลาง" : "Lead คุณภาพต่ำ"}
                      </p>
                      <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                        คะแนน {latestScore.score}/100
                      </p>
                    </div>
                  </div>
                  {latestScore.reasoning && (
                    <div
                      className="rounded-lg p-3 text-sm"
                      style={{ backgroundColor: "var(--color-canvas)", color: "var(--color-ink)" }}
                    >
                      {latestScore.reasoning}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  ยังไม่มีการให้คะแนน
                </p>
              )}
            </div>
          </div>

          {/* Right column: Actions + Tags + Status */}
          <div className="space-y-5">
            {/* Client interactive section */}
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
