import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Sidebar from "@/components/sidebar"
import type { WorkspaceRole } from "@/lib/permissions"

interface WorkspaceLayoutProps {
  children: React.ReactNode
  params: Promise<{ workspaceId: string }>
}

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { workspaceId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // ตรวจสอบว่า user เป็น member ของ workspace นี้จริง + ดึง role
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!membership) {
    // user ไม่มีสิทธิ์เข้า workspace นี้ → กลับหน้าเลือก workspace
    redirect("/")
  }

  // ดึงชื่อ workspace
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, type")
    .eq("id", workspaceId)
    .single()

  if (!workspace) redirect("/")

  const userMeta = user.user_metadata as { full_name?: string } | undefined
  const displayName = userMeta?.full_name ?? user.email ?? "ผู้ใช้งาน"
  const email = user.email ?? ""
  const role = membership.role as WorkspaceRole

  return (
    <div className="flex min-h-screen">
      <Sidebar
        displayName={displayName}
        email={email}
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        role={role}
      />
      <main className="flex-1 overflow-auto" style={{ backgroundColor: "var(--color-canvas)" }}>
        {children}
      </main>
    </div>
  )
}
