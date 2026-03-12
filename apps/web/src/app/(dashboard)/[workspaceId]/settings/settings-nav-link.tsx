"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface SettingsNavLinkProps {
  href: string
  label: string
}

export default function SettingsNavLink({ href, label }: SettingsNavLinkProps) {
  const pathname = usePathname()
  const isActive = pathname === href

  return (
    <Link
      href={href}
      className={cn(
        "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "border-primary text-primary"
          : "border-transparent text-muted hover:border-border hover:text-ink"
      )}
      style={
        isActive
          ? {
              borderColor: "var(--color-primary)",
              color: "var(--color-primary)",
            }
          : {
              borderColor: "transparent",
              color: "var(--color-muted)",
            }
      }
    >
      {label}
    </Link>
  )
}
