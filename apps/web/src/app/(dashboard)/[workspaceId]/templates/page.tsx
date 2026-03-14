import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import TemplateListClient from "./template-list-client"

interface PageProps {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<{ category?: string; page?: string }>
}

export default async function TemplatesPage({ params, searchParams }: PageProps) {
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

  // จำนวน templates ทั้งหมด
  const { count: totalTemplates } = await supabase
    .from("email_templates")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)

  // หมวดหมู่ที่มีอยู่ใน DB
  const { data: categories } = await supabase
    .from("email_templates")
    .select("category")
    .eq("workspace_id", workspaceId)
    .not("category", "is", null)

  const uniqueCategories = [
    ...new Set((categories ?? []).map((c) => c.category).filter(Boolean)),
  ] as string[]

  const total = totalTemplates ?? 0

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-canvas)" }}>
      <div className="px-6 py-8 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--color-ink)", letterSpacing: "-0.01em" }}
            >
              เทมเพลตอีเมล
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
              {total} เทมเพลต · จัดกลุ่มตามหมวดหมู่
            </p>
          </div>

          {canEdit && (
            <div className="flex shrink-0 items-center gap-2">
              {/* Import button — outline */}
              <Button
                variant="outline"
                className="gap-2"
                style={{
                  borderRadius: "var(--radius-btn)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-ink)",
                }}
              >
                <Upload className="h-4 w-4" />
                นำเข้า
              </Button>

              {/* Create button — primary filled */}
              <Link href={`/${workspaceId}/templates/new`}>
                <Button
                  className="gap-2 text-white"
                  style={{
                    backgroundColor: "var(--color-primary)",
                    borderRadius: "var(--radius-btn)",
                  }}
                >
                  <Plus className="h-4 w-4" />
                  สร้างเทมเพลต
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Template List with filter pills + grid */}
        <TemplateListClient
          workspaceId={workspaceId}
          canEdit={canEdit}
          categories={uniqueCategories}
          initialCategory={sp.category}
          initialPage={sp.page ? parseInt(sp.page) : 1}
        />
      </div>
    </div>
  )
}
