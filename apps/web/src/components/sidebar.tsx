"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Mail,
  Megaphone,
  Settings,
  LogOut,
  ChevronDown,
  Building2,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { canAccessSettings } from "@/lib/permissions"

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  requiresRole?: string[]
}

function getNavItems(workspaceId: string): NavItem[] {
  return [
    {
      href: `/${workspaceId}`,
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: `/${workspaceId}/leads`,
      label: "Leads",
      icon: Users,
    },
    {
      href: `/${workspaceId}/campaigns`,
      label: "Campaigns",
      icon: Megaphone,
    },
    {
      href: `/${workspaceId}/email`,
      label: "Email",
      icon: Mail,
    },
    {
      href: `/${workspaceId}/settings`,
      label: "Settings",
      icon: Settings,
      requiresRole: ["agency_admin", "agency_member"],
    },
  ]
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

interface SidebarProps {
  displayName: string
  email: string
  workspaceId?: string
  workspaceName?: string
  role?: string
}

export default function Sidebar({
  displayName,
  email,
  workspaceId,
  workspaceName,
  role,
}: SidebarProps) {
  const pathname = usePathname()

  // ถ้าไม่มี workspaceId ให้แสดง nav แบบเดิม (หน้า workspace selection)
  const navItems = workspaceId ? getNavItems(workspaceId) : []

  const filteredNavItems = navItems.filter((item) => {
    if (!item.requiresRole) return true
    if (!role) return false
    return item.requiresRole.includes(role)
  })

  return (
    <aside
      className="flex h-screen w-64 shrink-0 flex-col"
      style={{ backgroundColor: "var(--color-primary)" }}
    >
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center px-6">
        <Link href="/">
          <span className="text-xl font-extrabold tracking-tight text-white">
            LeadFlow
          </span>
        </Link>
      </div>

      {/* Workspace Name */}
      {workspaceName && (
        <div
          className="mx-3 mb-1 flex items-center gap-2 rounded-lg px-3 py-2"
          style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
        >
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
            style={{
              backgroundColor: "rgba(255,255,255,0.15)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <Building2 className="h-3 w-3 text-white" />
          </div>
          <span className="truncate text-xs font-semibold text-white">
            {workspaceName}
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-0.5">
          {filteredNavItems.map(({ href, label, icon: Icon }) => {
            // exact match สำหรับ dashboard root ของ workspace
            const isActive =
              href === `/${workspaceId}`
                ? pathname === `/${workspaceId}`
                : pathname.startsWith(href)

            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                  style={{ borderRadius: "var(--radius-btn)" }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User Menu */}
      <div
        className="shrink-0 border-t px-3 py-3"
        style={{ borderColor: "rgba(255,255,255,0.12)" }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/10"
              style={{ borderRadius: "var(--radius-btn)" }}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback
                  className="text-xs font-semibold"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.2)",
                    color: "white",
                  }}
                >
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-white">
                  {displayName}
                </p>
                <p
                  className="truncate text-xs"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                >
                  {email}
                </p>
              </div>
              <ChevronDown
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: "rgba(255,255,255,0.6)" }}
              />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            side="top"
            className="w-52"
            style={{ borderRadius: "var(--radius-card)" }}
          >
            <DropdownMenuItem asChild>
              <Link
                href={
                  workspaceId
                    ? `/${workspaceId}/settings`
                    : "/"
                }
                className="cursor-pointer gap-2"
              >
                <Settings className="h-4 w-4" />
                ตั้งค่า Workspace
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/" className="cursor-pointer gap-2">
                <Building2 className="h-4 w-4" />
                เปลี่ยน Workspace
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href="/api/auth/signout"
                className="cursor-pointer gap-2"
                style={{ color: "var(--color-danger)" }}
              >
                <LogOut className="h-4 w-4" />
                ออกจากระบบ
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
