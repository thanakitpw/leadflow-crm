import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { canAccessSettings } from "@/lib/permissions"
import SettingsNavLink from "./settings-nav-link"

interface SettingsLayoutProps {
  children: React.ReactNode
  params: Promise<{ workspaceId: string }>
}

export default async function SettingsLayout({
  children,
  params,
}: SettingsLayoutProps) {
  const { workspaceId } = await params
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

  // client_viewer ไม่มีสิทธิ์เข้า settings
  if (!canAccessSettings(membership.role)) {
    redirect(`/${workspaceId}`)
  }

  const settingsNav = [
    { href: `/${workspaceId}/settings`, label: "ทั่วไป" },
    { href: `/${workspaceId}/settings/members`, label: "สมาชิก" },
  ]

  return (
    <div>
      {/* Header + Nav */}
      <div className="border-b px-8 pt-8" style={{ borderColor: "var(--color-border)" }}>
        <h1
          className="mb-1 text-2xl font-bold"
          style={{ color: "var(--color-ink)" }}
        >
          Settings
        </h1>
        <p className="mb-6 text-sm" style={{ color: "var(--color-muted)" }}>
          จัดการการตั้งค่า workspace
        </p>

        <nav className="-mb-px flex gap-1">
          {settingsNav.map(({ href, label }) => (
            <SettingsNavLink key={href} href={href} label={label} />
          ))}
        </nav>
      </div>

      {/* Page content */}
      {children}
    </div>
  )
}
