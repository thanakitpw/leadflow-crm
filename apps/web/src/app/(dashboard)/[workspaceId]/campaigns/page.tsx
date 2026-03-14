import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus, List } from "lucide-react"
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

  // นับจำนวน campaigns ทั้งหมด
  const { count: totalCampaigns } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)

  // หาเวลาอัพเดตล่าสุด
  const { data: latestCampaign } = await supabase
    .from("campaigns")
    .select("updated_at")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastUpdated = latestCampaign?.updated_at
    ? (() => {
        const diffMs = Date.now() - new Date(latestCampaign.updated_at).getTime()
        const diffMins = Math.floor(diffMs / 60000)
        if (diffMins < 1) return "เมื่อกี้"
        if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`
        const diffHrs = Math.floor(diffMins / 60)
        if (diffHrs < 24) return `${diffHrs} ชั่วโมงที่แล้ว`
        return `${Math.floor(diffHrs / 24)} วันที่แล้ว`
      })()
    : null

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-canvas)" }}>
      <div className="px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--color-ink)", letterSpacing: "-0.01em" }}
            >
              แคมเปญอีเมล
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
              {totalCampaigns ?? 0} แคมเปญ
              {lastUpdated ? ` · อัพเดตล่าสุด ${lastUpdated}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/${workspaceId}/sequences`}>
              <Button
                variant="outline"
                style={{
                  borderRadius: "var(--radius-btn)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-ink)",
                }}
              >
                <List className="mr-2 h-4 w-4" />
                ลำดับอีเมล
              </Button>
            </Link>
            {canEdit && (
              <Link href={`/${workspaceId}/campaigns/create`}>
                <Button
                  style={{
                    backgroundColor: "var(--color-primary)",
                    borderRadius: "var(--radius-btn)",
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  สร้างแคมเปญ
                </Button>
              </Link>
            )}
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
