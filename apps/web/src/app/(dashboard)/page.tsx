import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus } from "lucide-react"

type WorkspaceMember = {
  role: string
  workspace: {
    id: string
    name: string
    type: string
    agency: {
      type: string
    } | null
    workspace_members: { count: number }[]
  }
}

type WorkspaceStats = {
  leadCount: number
  campaignCount: number
  memberCount: number
}

async function getWorkspaceStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string
): Promise<WorkspaceStats> {
  const [leadsResult, campaignsResult, membersResult] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
    supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
    supabase
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
  ])

  return {
    leadCount: leadsResult.count ?? 0,
    campaignCount: campaignsResult.count ?? 0,
    memberCount: membersResult.count ?? 0,
  }
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

const agencyTypeLabel: Record<string, string> = {
  agency: "Agency",
  freelance: "Freelancer",
  inhouse: "In-house",
}

export default async function WorkspaceSelectionPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select(`
      role,
      workspace:workspaces (
        id,
        name,
        type,
        agency:agencies (type),
        workspace_members (count)
      )
    `)
    .eq("user_id", user.id)

  const workspaces = (
    memberships as unknown as WorkspaceMember[] | null
  )?.filter((m) => m.workspace) ?? []

  if (workspaces.length === 0) {
    redirect("/onboarding")
  }

  // ดึง stats สำหรับทุก workspace พร้อมกัน
  const statsMap = await Promise.all(
    workspaces.map(async ({ workspace }) => {
      const stats = await getWorkspaceStats(supabase, workspace.id)
      return { workspaceId: workspace.id, stats }
    })
  )
  const statsById = Object.fromEntries(
    statsMap.map(({ workspaceId, stats }) => [workspaceId, stats])
  )

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-16"
      style={{ backgroundColor: "var(--color-canvas)" }}
    >
      {/* Header */}
      <div className="mb-10 flex flex-col items-center gap-3 text-center">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            <span
              className="text-lg font-extrabold leading-none text-white"
            >
              L
            </span>
          </div>
          <span
            className="text-2xl font-bold"
            style={{ color: "var(--color-ink)" }}
          >
            LeadFlow
          </span>
        </div>

        {/* Title */}
        <div className="mt-2">
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--color-ink)", letterSpacing: "-0.01em" }}
          >
            เลือก Workspace
          </h1>
          <p
            className="mt-1.5 text-sm"
            style={{ color: "var(--color-muted)" }}
          >
            เลือก workspace ที่คุณต้องการเข้าใช้งาน
          </p>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="flex w-full max-w-5xl flex-wrap justify-center gap-6">
        {workspaces.map(({ workspace }) => {
          const stats = statsById[workspace.id]
          const aType =
            (workspace.agency as { type: string } | null)?.type ?? "agency"
          const initials = getInitials(workspace.name)
          const typeLabel = agencyTypeLabel[aType] ?? aType

          return (
            <div
              key={workspace.id}
              className="flex flex-col"
              style={{
                width: "280px",
                backgroundColor: "#FFFFFF",
                borderRadius: "16px",
                border: "1.5px solid var(--color-border)",
                padding: "24px",
                gap: "20px",
              }}
            >
              {/* Card Top: Avatar + Name + Type */}
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: "var(--color-primary)" }}
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-bold leading-tight"
                    style={{ color: "var(--color-ink)" }}
                  >
                    {workspace.name}
                  </p>
                  <p
                    className="mt-0.5 text-xs"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {typeLabel}
                  </p>
                </div>
              </div>

              {/* Stats Row */}
              <div
                className="grid grid-cols-3 divide-x"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div className="flex flex-col items-center gap-0.5 pr-3">
                  <span
                    className="text-xl font-bold leading-tight tabular-nums"
                    style={{ color: "var(--color-ink)" }}
                  >
                    {stats?.leadCount ?? "—"}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-muted)" }}
                  >
                    ลีด
                  </span>
                </div>
                <div className="flex flex-col items-center gap-0.5 px-3">
                  <span
                    className="text-xl font-bold leading-tight tabular-nums"
                    style={{ color: "var(--color-ink)" }}
                  >
                    {stats?.campaignCount ?? "—"}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-muted)" }}
                  >
                    แคมเปญ
                  </span>
                </div>
                <div className="flex flex-col items-center gap-0.5 pl-3">
                  <span
                    className="text-xl font-bold leading-tight tabular-nums"
                    style={{ color: "var(--color-ink)" }}
                  >
                    {stats?.memberCount ?? "—"}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-muted)" }}
                  >
                    สมาชิก
                  </span>
                </div>
              </div>

              {/* CTA Button */}
              <Link href={`/${workspace.id}`} className="block">
                <button
                  className="w-full cursor-pointer py-2.5 text-sm font-semibold transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
                  style={{
                    backgroundColor: "var(--color-primary)",
                    color: "#FFFFFF",
                    borderRadius: "var(--radius-btn)",
                    border: "none",
                  }}
                >
                  เข้าใช้งาน
                </button>
              </Link>
            </div>
          )
        })}

        {/* Create New Workspace Card */}
        <Link href="/onboarding" className="block" style={{ width: "280px" }}>
          <div
            className="flex h-full flex-col items-center justify-center gap-3 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
            style={{
              minHeight: "220px",
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              border: "1.5px dashed var(--color-border)",
              padding: "24px",
              cursor: "pointer",
            }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--color-canvas)" }}
            >
              <Plus
                className="h-5 w-5"
                style={{ color: "var(--color-muted)" }}
              />
            </div>
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--color-muted)" }}
            >
              สร้าง Workspace ใหม่
            </p>
          </div>
        </Link>
      </div>

      {/* Footer */}
      <p
        className="mt-10 text-center text-xs"
        style={{ color: "var(--color-muted)" }}
      >
        ล็อกอินในฐานะ: {user.email} ·{" "}
        <Link
          href="/api/auth/signout"
          className="hover:underline"
          style={{ color: "var(--color-danger)" }}
        >
          ออกจากระบบ
        </Link>
      </p>
    </div>
  )
}
