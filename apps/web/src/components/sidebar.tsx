"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import {
  LayoutDashboard,
  Search,
  Users,
  MailOpen,
  FileText,
  GitBranch,
  Settings,
  HelpCircle,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "sidebar-collapsed"


interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  requiresRole?: string[]
  badge?: React.ReactNode
}

interface NavSection {
  title: string
  items: NavItem[]
}

function getNavSections(workspaceId: string): NavSection[] {
  return [
    {
      title: "ทั่วไป",
      items: [
        {
          href: `/${workspaceId}`,
          label: "แดชบอร์ด",
          icon: LayoutDashboard,
        },
        {
          href: `/${workspaceId}/leads/search`,
          label: "ค้นหาลีด",
          icon: Search,
        },
        {
          href: `/${workspaceId}/leads`,
          label: "ลีด",
          icon: Users,
        },
        {
          href: `/${workspaceId}/campaigns`,
          label: "แคมเปญ",
          icon: MailOpen,
        },
      ],
    },
    {
      title: "เครื่องมือ",
      items: [
        {
          href: `/${workspaceId}/templates`,
          label: "เทมเพลต",
          icon: FileText,
        },
        {
          href: `/${workspaceId}/sequences`,
          label: "ลำดับอีเมล",
          icon: GitBranch,
        },
      ],
    },
    {
      title: "สนับสนุน",
      items: [
        {
          href: `/${workspaceId}/settings`,
          label: "ตั้งค่า",
          icon: Settings,
          requiresRole: ["agency_admin", "agency_member"],
        },
        {
          href: `/${workspaceId}/help`,
          label: "ช่วยเหลือ",
          icon: HelpCircle,
        },
      ],
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

  const sections = workspaceId ? getNavSections(workspaceId) : []

  // กรอง items ตาม role
  const filteredSections = sections.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!item.requiresRole) return true
      if (!role) return false
      return item.requiresRole.includes(role)
    }),
  }))

  const isCollapsed = mounted ? collapsed : false

  return (
    <aside
      className="sticky top-0 flex h-screen shrink-0 flex-col overflow-visible transition-[width] duration-300 ease-in-out"
      style={{
        width: isCollapsed ? "64px" : "210px",
        backgroundColor: "var(--color-white)",
        borderRight: "1px solid var(--color-border)",
      }}
    >
      {/* Toggle Button */}
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
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            <span className="text-xs font-extrabold text-white">L</span>
          </div>
          <span
            className="whitespace-nowrap text-[18px] font-bold tracking-tight transition-[opacity,width] duration-300 ease-in-out overflow-hidden"
            style={{
              color: "var(--color-ink)",
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
                  className="flex h-9 w-full items-center justify-center rounded-lg transition-colors"
                  style={{ borderRadius: "10px" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "var(--color-canvas)"
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = ""
                  }}
                >
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
                    style={{
                      backgroundColor: "var(--color-primary-light)",
                      borderRadius: "4px",
                    }}
                  >
                    <Building2
                      className="h-3 w-3"
                      style={{ color: "var(--color-primary)" }}
                    />
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
              style={{
                backgroundColor: "var(--color-canvas)",
                borderRadius: "10px",
              }}
            >
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
                style={{
                  backgroundColor: "var(--color-primary-light)",
                  borderRadius: "4px",
                }}
              >
                <Building2
                  className="h-3 w-3"
                  style={{ color: "var(--color-primary)" }}
                />
              </div>
              <span
                className="truncate text-xs font-semibold"
                style={{ color: "var(--color-ink)" }}
              >
                {workspaceName}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      <div
        className="mx-4 mb-1 h-px"
        style={{ backgroundColor: "var(--color-border)" }}
      />

      {/* Navigation */}
      <nav className="flex-1 overflow-x-hidden overflow-y-auto px-2 pb-2">
        {filteredSections.map((section) => (
          <div key={section.title}>
            {/* Section Header — ซ่อนตอน collapsed */}
            {!isCollapsed && (
              <p
                className="px-4 pb-2 pt-6 text-xs font-medium uppercase tracking-wide"
                style={{ color: "var(--color-muted)" }}
              >
                {section.title}
              </p>
            )}
            {/* เว้นช่องว่างเล็กน้อยตอน collapsed แทน section header */}
            {isCollapsed && <div className="h-3" />}

            <ul className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon, badge }) => {
                // Collect all sibling hrefs to prevent parent matching when child has its own nav item
                const allHrefs = section.items.map((i) => i.href)
                const isActive =
                  href === `/${workspaceId}`
                    ? pathname === `/${workspaceId}`
                    : href !== "#" && (
                        pathname === href ||
                        (pathname.startsWith(href + "/") &&
                          !allHrefs.some((other) => other !== href && other.startsWith(href + "/") && pathname.startsWith(other)))
                      )

                const linkContent = (
                  <Link
                    href={href}
                    className={cn(
                      "group relative flex items-center gap-3 py-2 text-sm font-medium transition-colors duration-150",
                      isCollapsed ? "justify-center px-0" : "mx-2 px-3"
                    )}
                    style={{
                      borderRadius: "8px",
                      height: "36px",
                      backgroundColor: isActive
                        ? "var(--color-primary-light)"
                        : undefined,
                      color: isActive
                        ? "var(--color-primary)"
                        : "var(--color-ink)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          "var(--color-canvas)"
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          ""
                      }
                    }}
                  >
                    <Icon
                      className="shrink-0 transition-colors duration-150"
                      style={{
                        width: "18px",
                        height: "18px",
                        color: isActive
                          ? "var(--color-primary)"
                          : "var(--color-muted)",
                      }}
                    />
                    {/* Label + badge — ซ่อนตอน collapsed */}
                    <span
                      className="flex flex-1 items-center overflow-hidden whitespace-nowrap transition-[opacity,max-width] duration-300 ease-in-out"
                      style={{
                        opacity: isCollapsed ? 0 : 1,
                        maxWidth: isCollapsed ? "0px" : "200px",
                        display: "flex",
                      }}
                    >
                      <span className="flex-1 truncate">{label}</span>
                      {badge && !isCollapsed && badge}
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
          </div>
        ))}
      </nav>

      {/* Divider before user menu */}
      <div
        className="mx-4 h-px"
        style={{ backgroundColor: "var(--color-border)" }}
      />

      {/* User Menu */}
      <div className="shrink-0 px-2 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex w-full items-center justify-center rounded-lg px-0 py-2 transition-colors"
                    style={{ borderRadius: "10px" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        "var(--color-canvas)"
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        ""
                    }}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback
                        className="text-xs font-semibold"
                        style={{
                          backgroundColor: "var(--color-primary-light)",
                          color: "var(--color-primary)",
                        }}
                      >
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p className="font-medium">{displayName}</p>
                  <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                    {email}
                  </p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors"
                style={{ borderRadius: "10px" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    "var(--color-canvas)"
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = ""
                }}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback
                    className="text-xs font-semibold"
                    style={{
                      backgroundColor: "var(--color-primary-light)",
                      color: "var(--color-primary)",
                    }}
                  >
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <p
                    className="truncate text-sm font-medium"
                    style={{ color: "var(--color-ink)" }}
                  >
                    {displayName}
                  </p>
                  <p
                    className="truncate text-xs"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {email}
                  </p>
                </div>
                <ChevronDown
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: "var(--color-muted)" }}
                />
              </button>
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align={isCollapsed ? "start" : "end"}
            side="top"
            className="w-52"
            style={{
              borderRadius: "12px",
              backgroundColor: "#FFFFFF",
              border: "1px solid var(--color-border)",
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
