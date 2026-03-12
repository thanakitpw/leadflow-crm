import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Building2, Users, Plus, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

type WorkspaceMember = {
  role: string
  workspace: {
    id: string
    name: string
    type: string
    workspace_members: { count: number }[]
  }
}

export default async function WorkspaceSelectionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // ดึง workspaces ที่ user เป็น member
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select(`
      role,
      workspace:workspaces (
        id,
        name,
        type,
        workspace_members (count)
      )
    `)
    .eq("user_id", user.id)

  const workspaces = (memberships as unknown as WorkspaceMember[] | null)?.filter(m => m.workspace) ?? []

  // ถ้าไม่มี workspace เลย → ไป onboarding
  if (workspaces.length === 0) {
    redirect("/onboarding")
  }

  const roleLabel: Record<string, string> = {
    agency_admin: "Admin",
    agency_member: "Member",
    client_viewer: "Viewer",
  }

  const typeLabel: Record<string, string> = {
    agency: "Agency",
    client: "Client",
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <span
            className="mb-4 block text-3xl font-extrabold tracking-tight"
            style={{ color: "var(--color-primary)" }}
          >
            LeadFlow
          </span>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--color-ink)" }}
          >
            เลือก Workspace
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
            คุณเป็นสมาชิกของ {workspaces.length} workspace
          </p>
        </div>

        {/* Workspace List */}
        <div className="space-y-3">
          {workspaces.map(({ role, workspace }) => {
            const memberCount = workspace.workspace_members[0]?.count ?? 0

            return (
              <Link key={workspace.id} href={`/${workspace.id}`}>
                <Card
                  className="group cursor-pointer border-border transition-all hover:border-primary/40 hover:shadow-sm"
                  style={{ borderRadius: "var(--radius-card)" }}
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Icon */}
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: "var(--color-primary-light)" }}
                    >
                      <Building2
                        className="h-5 w-5"
                        style={{ color: "var(--color-primary)" }}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h2
                          className="truncate text-sm font-semibold"
                          style={{ color: "var(--color-ink)" }}
                        >
                          {workspace.name}
                        </h2>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: "var(--color-primary-light)",
                            color: "var(--color-primary)",
                            borderRadius: "var(--radius-badge)",
                          }}
                        >
                          {typeLabel[workspace.type] ?? workspace.type}
                        </span>
                      </div>
                      <div
                        className="mt-0.5 flex items-center gap-1 text-xs"
                        style={{ color: "var(--color-muted)" }}
                      >
                        <Users className="h-3 w-3" />
                        <span>{memberCount} สมาชิก</span>
                        <span className="mx-1.5">·</span>
                        <span>{roleLabel[role] ?? role}</span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight
                      className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                      style={{ color: "var(--color-muted)" }}
                    />
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>

        {/* New Workspace Button */}
        <div className="mt-4">
          <Link href="/onboarding">
            <Button
              variant="outline"
              className="w-full h-10 gap-2 border-dashed text-sm font-medium"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-muted)",
                borderRadius: "var(--radius-btn)",
              }}
            >
              <Plus className="h-4 w-4" />
              สร้าง Workspace ใหม่
            </Button>
          </Link>
        </div>

        {/* Sign out */}
        <p className="mt-6 text-center text-xs" style={{ color: "var(--color-muted)" }}>
          ลงชื่อเข้าในฐานะ {user.email} ·{" "}
          <Link
            href="/api/auth/signout"
            className="hover:underline"
            style={{ color: "var(--color-primary)" }}
          >
            ออกจากระบบ
          </Link>
        </p>
      </div>
    </div>
  )
}
