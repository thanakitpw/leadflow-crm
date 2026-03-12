import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus, Sparkles } from "lucide-react"
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

  // สถิติ templates
  const { count: totalTemplates } = await supabase
    .from("email_templates")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)

  // หมวดหมู่ทั้งหมด
  const { data: categories } = await supabase
    .from("email_templates")
    .select("category")
    .eq("workspace_id", workspaceId)
    .not("category", "is", null)

  const uniqueCategories = [...new Set((categories ?? []).map((c) => c.category).filter(Boolean))]

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-canvas)" }}>
      <div className="px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
              Email Templates
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
              จัดการ templates สำหรับส่งอีเมล ({totalTemplates ?? 0} templates)
            </p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {}}
                style={{ borderRadius: "var(--radius-btn)" }}
              >
                <Sparkles
                  className="mr-2 h-4 w-4"
                  style={{ color: "var(--color-ai)" }}
                />
                AI เขียนให้
              </Button>
              <Link href={`/${workspaceId}/templates/new`}>
                <Button
                  style={{
                    backgroundColor: "var(--color-primary)",
                    borderRadius: "var(--radius-btn)",
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  สร้าง Template
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Template List Client */}
        <TemplateListClient
          workspaceId={workspaceId}
          canEdit={canEdit}
          categories={uniqueCategories as string[]}
          initialCategory={sp.category}
          initialPage={sp.page ? parseInt(sp.page) : 1}
        />
      </div>
    </div>
  )
}
