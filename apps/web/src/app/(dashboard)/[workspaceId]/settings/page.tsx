import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { canDeleteWorkspace, canEditWorkspace } from "@/lib/permissions"
import WorkspaceGeneralForm from "./general-form"

interface PageProps {
  params: Promise<{ workspaceId: string }>
}

export default async function WorkspaceSettingsPage({ params }: PageProps) {
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

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, type, created_at")
    .eq("id", workspaceId)
    .single()

  if (!workspace) redirect("/")

  const role = membership.role
  const canEdit = canEditWorkspace(role)
  const canDelete = canDeleteWorkspace(role)

  const typeLabel: Record<string, string> = {
    agency: "Agency Workspace",
    client: "Client Workspace",
  }

  return (
    <div className="p-8">
      <div className="max-w-xl space-y-6">
        {/* Workspace Info Card */}
        <div
          className="rounded-xl border bg-white p-6"
          style={{
            borderColor: "var(--color-border)",
            borderRadius: "var(--radius-card)",
          }}
        >
          <h2
            className="mb-1 text-base font-semibold"
            style={{ color: "var(--color-ink)" }}
          >
            ข้อมูล Workspace
          </h2>
          <p className="mb-5 text-xs" style={{ color: "var(--color-muted)" }}>
            แก้ไขชื่อและดูข้อมูลพื้นฐานของ workspace
          </p>

          {/* Type badge (read-only) */}
          <div className="mb-5">
            <label
              className="mb-1.5 block text-xs font-medium"
              style={{ color: "var(--color-muted)" }}
            >
              ประเภท Workspace
            </label>
            <span
              className="inline-block rounded px-3 py-1 text-sm font-medium"
              style={{
                backgroundColor: "var(--color-primary-light)",
                color: "var(--color-primary)",
                borderRadius: "var(--radius-btn)",
              }}
            >
              {typeLabel[workspace.type] ?? workspace.type}
            </span>
          </div>

          {/* Workspace ID (read-only) */}
          <div className="mb-5">
            <label
              className="mb-1.5 block text-xs font-medium"
              style={{ color: "var(--color-muted)" }}
            >
              Workspace ID
            </label>
            <p
              className="rounded px-3 py-2 font-mono text-xs"
              style={{
                backgroundColor: "var(--color-canvas)",
                color: "var(--color-muted)",
                borderRadius: "var(--radius-input)",
                border: "1px solid var(--color-border)",
              }}
            >
              {workspace.id}
            </p>
          </div>

          {/* Editable name form */}
          <WorkspaceGeneralForm
            workspaceId={workspaceId}
            initialName={workspace.name}
            canEdit={canEdit}
          />
        </div>

        {/* Danger Zone — agency owner เท่านั้น + ห้ามลบ agency workspace */}
        {canDelete && workspace.type !== "agency" && (
          <div
            className="rounded-xl border p-6"
            style={{
              borderColor: "#FECACA",
              borderRadius: "var(--radius-card)",
              backgroundColor: "#FFF5F5",
            }}
          >
            <h2
              className="mb-1 text-base font-semibold"
              style={{ color: "var(--color-danger)" }}
            >
              Danger Zone
            </h2>
            <p className="mb-5 text-xs" style={{ color: "var(--color-muted)" }}>
              การลบ workspace จะไม่สามารถกู้คืนได้ ข้อมูลทั้งหมดจะหายไปถาวร
            </p>

            <WorkspaceGeneralForm
              workspaceId={workspaceId}
              initialName={workspace.name}
              canEdit={canEdit}
              showDeleteOnly
            />
          </div>
        )}
      </div>
    </div>
  )
}
