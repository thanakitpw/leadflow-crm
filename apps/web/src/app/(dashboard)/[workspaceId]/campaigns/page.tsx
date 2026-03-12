import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import CampaignListClient from "./campaign-list-client"

interface PageProps {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<{ status?: string; page?: string }>
}

export default async function CampaignsPage({ params, searchParams }: PageProps) {
  const { workspaceId } = await params
  const sp = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!membership) redirect("/")

  const canEdit = ["agency_admin", "agency_member"].includes(membership.role)

  // สถิติ campaigns
  const { count: totalCampaigns } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)

  const { count: activeCampaigns } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .in("status", ["sending", "scheduled"])

  const { count: draftCampaigns } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "draft")

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-canvas)" }}>
      <div className="px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
              Campaigns
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
              จัดการแคมเปญอีเมลและติดตามผลการส่ง
            </p>
          </div>
          {canEdit && (
            <Link href={`/${workspaceId}/campaigns/create`}>
              <Button
                style={{
                  backgroundColor: "var(--color-primary)",
                  borderRadius: "var(--radius-btn)",
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                สร้าง Campaign
              </Button>
            </Link>
          )}
        </div>

        {/* Stats Bar */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div
            className="rounded-xl border bg-white p-4"
            style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
          >
            <p className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
              Campaigns ทั้งหมด
            </p>
            <p className="mt-1 text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
              {totalCampaigns ?? 0}
            </p>
          </div>
          <div
            className="rounded-xl border bg-white p-4"
            style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
          >
            <p className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
              กำลังส่ง / กำหนดเวลา
            </p>
            <p className="mt-1 text-2xl font-bold" style={{ color: "var(--color-success)" }}>
              {activeCampaigns ?? 0}
            </p>
          </div>
          <div
            className="rounded-xl border bg-white p-4"
            style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
          >
            <p className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
              Draft
            </p>
            <p className="mt-1 text-2xl font-bold" style={{ color: "var(--color-warning)" }}>
              {draftCampaigns ?? 0}
            </p>
          </div>
        </div>

        {/* Campaign List Client */}
        <CampaignListClient
          workspaceId={workspaceId}
          canEdit={canEdit}
          initialStatus={sp.status}
          initialPage={sp.page ? parseInt(sp.page) : 1}
        />
      </div>
    </div>
  )
}
