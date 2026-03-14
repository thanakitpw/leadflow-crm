import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Search, Download, Trash2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import LeadListClient from "./lead-list-client"

interface PageProps {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<{
    status?: string
    hasEmail?: string
    minScore?: string
    maxScore?: string
    sortBy?: string
    page?: string
  }>
}

export default async function LeadsPage({ params, searchParams }: PageProps) {
  const { workspaceId } = await params
  const sp = await searchParams

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

  // ดึงสถิติ leads แบบง่าย
  const { count: totalLeads } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)

  const { count: leadsWithEmail } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .not("email", "is", null)
    .neq("email", "")

  const { count: newLeads } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "new")

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-canvas)" }}>
      <div className="px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
              Leads
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
              จัดการและติดตาม leads ทั้งหมดใน workspace นี้
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Link href={`/${workspaceId}/leads/search`}>
                <Button
                  className="text-white"
                  style={{ backgroundColor: "var(--color-primary)", borderRadius: "var(--radius-btn)" }}
                >
                  <Search className="mr-2 h-4 w-4" />
                  ค้นหา Lead ใหม่
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div
            className="rounded-xl border bg-white p-4"
            style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
          >
            <p className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
              Leads ทั้งหมด
            </p>
            <p className="mt-1 text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
              {totalLeads ?? 0}
            </p>
          </div>
          <div
            className="rounded-xl border bg-white p-4"
            style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
          >
            <p className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
              มีอีเมล
            </p>
            <p className="mt-1 text-2xl font-bold" style={{ color: "#16A34A" }}>
              {leadsWithEmail ?? 0}
            </p>
          </div>
          <div
            className="rounded-xl border bg-white p-4"
            style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
          >
            <p className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
              รอติดต่อ (New)
            </p>
            <p className="mt-1 text-2xl font-bold" style={{ color: "#D97706" }}>
              {newLeads ?? 0}
            </p>
          </div>
        </div>

        {/* Client Component: ตาราง + filter + bulk actions */}
        <LeadListClient
          workspaceId={workspaceId}
          canEdit={canEdit}
          initialStatus={sp.status}
          initialHasEmail={sp.hasEmail}
          initialSortBy={sp.sortBy}
          initialPage={sp.page ? parseInt(sp.page) : 1}
        />
      </div>
    </div>
  )
}
