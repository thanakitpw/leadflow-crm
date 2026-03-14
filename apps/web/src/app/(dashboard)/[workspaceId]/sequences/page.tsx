import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import SequenceListClient from "./sequence-list-client"

interface PageProps {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<{ page?: string }>
}

export default async function SequencesPage({ params, searchParams }: PageProps) {
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

  const { count: totalSequences } = await supabase
    .from("sequences")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)

  const total = totalSequences ?? 0

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-canvas)" }}>
      <div className="px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--color-ink)", letterSpacing: "-0.01em" }}
            >
              ลำดับอีเมล
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
              {total > 0
                ? `${total} ลำดับ · ส่งอีเมลอัตโนมัติตามลำดับที่กำหนด`
                : "ส่งอีเมลอัตโนมัติตามลำดับที่กำหนด"}
            </p>
          </div>
          {canEdit && (
            <Link href={`/${workspaceId}/sequences/new`}>
              <Button
                className="text-white"
                style={{
                  backgroundColor: "var(--color-primary)",
                  borderRadius: "var(--radius-btn)",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                สร้างลำดับใหม่
              </Button>
            </Link>
          )}
        </div>

        <SequenceListClient
          workspaceId={workspaceId}
          canEdit={canEdit}
          initialPage={sp.page ? parseInt(sp.page) : 1}
        />
      </div>
    </div>
  )
}
