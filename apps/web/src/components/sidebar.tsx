"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import {
  LayoutDashboard,
  Users,
  MailOpen,
  FileText,
  GitBranch,
  Settings,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Building2,
  BarChart3,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { canAccessSettings } from "@/lib/permissions"

const STORAGE_KEY = "sidebar-collapsed"

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
      label: "แดชบอร์ด",
      icon: LayoutDashboard,
    },
    {
      href: `/${workspaceId}/leads`,
      label: "รายชื่อลีด",
      icon: Users,
    },
    {
      href: `/${workspaceId}/campaigns`,
      label: "แคมเปญ",
      icon: MailOpen,
    },
    {
      href: `/${workspaceId}/templates`,
      label: "เทมเพลต",
      icon: FileText,
    },
    {
      href: `/${workspaceId}/sequences`,
      label: "ซีเควนซ์",
      icon: GitBranch,
    },
    {
      href: `/${workspaceId}/reports`,
      label: "รายงาน",
      icon: BarChart3,
    },
    {
      href: `/${workspaceId}/settings`,
      label: "ตั้งค่า",
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
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  // อ่านค่าจาก localStorage หลัง mount เท่านั้น (ป้องกัน hydration mismatch)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === "true") setCollapsed(true)
    setMounted(true)
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }, [])

  const navItems = workspaceId ? getNavItems(workspaceId) : []

  const filteredNavItems = navItems.filter((item) => {
    if (!item.requiresRole) return true
    if (!role) return false
    return item.requiresRole.includes(role)
  })

  // ป้องกัน layout shift ก่อน mount — render เป็น expanded ก่อน
  const isCollapsed = mounted ? collapsed : false

  return (
    <aside
      className="sticky top-0 flex h-screen shrink-0 flex-col overflow-visible transition-[width] duration-300 ease-in-out"
      style={{
        width: isCollapsed ? "64px" : "240px",
        background: "linear-gradient(180deg, #1E3A5F 0%, #152C4A 100%)",
      }}
    >
      {/* Toggle Button — ยื่นออกจากขอบขวาของ sidebar */}
      <button
        onClick={toggleCollapsed}
        aria-label={isCollapsed ? "ขยาย sidebar" : "ยุบ sidebar"}
        className="absolute z-20 flex h-6 w-6 items-center justify-center rounded-full shadow-md transition-all duration-300 hover:scale-110"
        style={{
          top: "28px",
          right: "-12px",
          backgroundColor: "#FFFFFF",
          border: "1.5px solid var(--color-border)",
          color: "var(--color-primary)",
        }}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>

      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center overflow-hidden px-4">
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          {/* Icon-only logo mark */}
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
          >
            <span className="text-xs font-extrabold text-white">L</span>
          </div>
          <span
            className="whitespace-nowrap text-lg font-extrabold tracking-tight text-white transition-[opacity,width] duration-300 ease-in-out overflow-hidden"
            style={{
              opacity: isCollapsed ? 0 : 1,
              width: isCollapsed ? "0px" : "120px",
              display: "block",
            }}
          >
            LeadFlow
          </span>
        </Link>
      </div>

      {/* Workspace Name */}
      {workspaceName && (
        <div className="mx-2 mb-1 overflow-hidden">
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex h-9 w-full items-center justify-center rounded-lg transition-colors hover:bg-white/10"
                  style={{ borderRadius: "10px" }}
                >
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.15)",
                      borderRadius: "4px",
                    }}
                  >
                    <Building2 className="h-3 w-3 text-white" />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <p>{workspaceName}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "10px" }}
            >
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
                style={{
                  backgroundColor: "rgba(255,255,255,0.15)",
                  borderRadius: "4px",
                }}
              >
                <Building2 className="h-3 w-3 text-white" />
              </div>
              <span className="truncate text-xs font-semibold text-white">
                {workspaceName}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      <div
        className="mx-4 mb-2 h-px"
        style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
      />

      {/* Navigation */}
      <nav className="flex-1 overflow-x-hidden overflow-y-auto px-2 py-1">
        <ul className="space-y-0.5">
          {filteredNavItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === `/${workspaceId}`
                ? pathname === `/${workspaceId}`
                : pathname.startsWith(href)

            const linkContent = (
              <Link
                href={href}
                className={cn(
                  "group relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  isActive
                    ? "text-white"
                    : "text-white/65 hover:text-white"
                )}
                style={{
                  borderRadius: "10px",
                  backgroundColor: isActive
                    ? "rgba(255,255,255,0.14)"
                    : undefined,
                  justifyContent: isCollapsed ? "center" : undefined,
                  paddingLeft: isCollapsed ? "0" : undefined,
                  paddingRight: isCollapsed ? "0" : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "rgba(255,255,255,0.08)"
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = ""
                  }
                }}
              >
                {/* Active left border accent */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full"
                    style={{ backgroundColor: "rgba(255,255,255,0.7)" }}
                  />
                )}
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-150",
                    isActive ? "text-white" : "text-white/65 group-hover:text-white"
                  )}
                />
                {/* Label with fade/slide transition */}
                <span
                  className="overflow-hidden whitespace-nowrap transition-[opacity,max-width] duration-300 ease-in-out"
                  style={{
                    opacity: isCollapsed ? 0 : 1,
                    maxWidth: isCollapsed ? "0px" : "160px",
                    display: "block",
                  }}
                >
                  {label}
                </span>
              </Link>
            )

            return (
              <li key={href}>
                {isCollapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      <p>{label}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  linkContent
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Subtle divider before user menu */}
      <div
        className="mx-4 h-px"
        style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
      />

      {/* User Menu */}
      <div className="shrink-0 px-2 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex w-full items-center justify-center rounded-lg px-0 py-2 transition-colors hover:bg-white/10"
                    style={{ borderRadius: "10px" }}
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
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p className="font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{email}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/10"
                style={{ borderRadius: "10px" }}
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
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align={isCollapsed ? "start" : "end"}
            side="top"
            className="w-52 border-border bg-white text-ink shadow-lg"
            style={{
              borderRadius: "12px",
              backgroundColor: "#FFFFFF",
              color: "var(--color-ink)",
            }}
          >
            <DropdownMenuItem asChild>
              <Link
                href={workspaceId ? `/${workspaceId}/settings` : "/"}
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
