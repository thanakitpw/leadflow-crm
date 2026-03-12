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

  const { count: activeSequences } = await supabase
    .from("sequences")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "active")

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-canvas)" }}>
      <div className="px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
              Email Sequences
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
              สร้าง sequences อีเมลอัตโนมัติ ({totalSequences ?? 0} sequences)
            </p>
          </div>
          {canEdit && (
            <Link href={`/${workspaceId}/sequences/new`}>
              <Button
                style={{
                  backgroundColor: "var(--color-primary)",
                  borderRadius: "var(--radius-btn)",
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                สร้าง Sequence
              </Button>
            </Link>
          )}
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 max-w-sm">
          <div
            className="rounded-xl border bg-white p-4"
            style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
          >
            <p className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
              Sequences ทั้งหมด
            </p>
            <p className="mt-1 text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
              {totalSequences ?? 0}
            </p>
          </div>
          <div
            className="rounded-xl border bg-white p-4"
            style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
          >
            <p className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
              กำลัง Active
            </p>
            <p className="mt-1 text-2xl font-bold" style={{ color: "var(--color-success)" }}>
              {activeSequences ?? 0}
            </p>
          </div>
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
