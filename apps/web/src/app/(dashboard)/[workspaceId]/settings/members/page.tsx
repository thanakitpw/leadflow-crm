import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { canManageMembers, getRoleLabel } from "@/lib/permissions"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import InviteMemberDialog from "./invite-dialog"
import MemberActions from "./member-actions"

interface PageProps {
  params: Promise<{ workspaceId: string }>
}

type MemberRow = {
  id: string
  role: string
  invited_email: string | null
  invited_at: string | null
  joined_at: string | null
  created_at: string
  profile: {
    id: string
    email: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function getRoleBadgeStyle(role: string): React.CSSProperties {
  switch (role) {
    case "agency_admin":
      return {
        backgroundColor: "var(--color-primary-light)",
        color: "var(--color-primary)",
      }
    case "agency_member":
      return { backgroundColor: "#DCFCE7", color: "var(--color-success)" }
    case "client_viewer":
      return { backgroundColor: "#F3F4F6", color: "var(--color-muted)" }
    default:
      return { backgroundColor: "#F3F4F6", color: "var(--color-muted)" }
  }
}

export default async function MembersPage({ params }: PageProps) {
  const { workspaceId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: selfMembership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!selfMembership) redirect("/")

  const role = selfMembership.role
  const canManage = canManageMembers(role)

  const { data: members, error } = await supabase
    .from("workspace_members")
    .select(
      `
      id,
      role,
      invited_email,
      invited_at,
      joined_at,
      created_at,
      profile:profiles ( id, email, full_name, avatar_url )
    `
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })

  if (error) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: "var(--color-danger)" }}>
          ไม่สามารถโหลดรายชื่อสมาชิกได้
        </p>
      </div>
    )
  }

  const memberList = (members ?? []) as unknown as MemberRow[]

  return (
    <div className="p-8">
      {/* Sub-header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--color-ink)" }}
          >
            รายชื่อสมาชิก
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: "var(--color-muted)" }}>
            {memberList.length} คนในทีม
          </p>
        </div>

        {canManage && <InviteMemberDialog workspaceId={workspaceId} />}
      </div>

      {/* Table */}
      <div
        className="overflow-hidden rounded-xl border bg-white"
        style={{
          borderColor: "var(--color-border)",
          borderRadius: "var(--radius-card)",
        }}
      >
        <Table>
          <TableHeader>
            <TableRow
              style={{
                backgroundColor: "var(--color-canvas)",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <TableHead
                className="text-xs font-semibold"
                style={{ color: "var(--color-muted)" }}
              >
                ชื่อ / Email
              </TableHead>
              <TableHead
                className="text-xs font-semibold"
                style={{ color: "var(--color-muted)" }}
              >
                Role
              </TableHead>
              <TableHead
                className="text-xs font-semibold"
                style={{ color: "var(--color-muted)" }}
              >
                วันที่เข้าร่วม
              </TableHead>
              <TableHead
                className="text-xs font-semibold"
                style={{ color: "var(--color-muted)" }}
              >
                สถานะ
              </TableHead>
              {canManage && (
                <TableHead
                  className="w-12 text-right text-xs font-semibold"
                  style={{ color: "var(--color-muted)" }}
                />
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {memberList.map((member) => {
              const displayName =
                member.profile?.full_name ??
                member.invited_email ??
                "ไม่ระบุชื่อ"
              const displayEmail =
                member.profile?.email ?? member.invited_email ?? "—"
              const isCurrentUser = member.profile?.id === user.id
              const isPending = !member.joined_at
              const badgeStyle = getRoleBadgeStyle(member.role)

              return (
                <TableRow
                  key={member.id}
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                >
                  {/* Name / Email */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: "var(--color-primary-light)",
                          color: "var(--color-primary)",
                        }}
                      >
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--color-ink)" }}
                        >
                          {displayName}
                          {isCurrentUser && (
                            <span
                              className="ml-1.5 text-xs"
                              style={{ color: "var(--color-muted)" }}
                            >
                              (คุณ)
                            </span>
                          )}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: "var(--color-muted)" }}
                        >
                          {displayEmail}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Role */}
                  <TableCell>
                    <span
                      className="rounded px-2 py-0.5 text-xs font-medium"
                      style={{
                        ...badgeStyle,
                        borderRadius: "var(--radius-badge)",
                      }}
                    >
                      {getRoleLabel(member.role)}
                    </span>
                  </TableCell>

                  {/* Joined Date */}
                  <TableCell
                    className="text-sm"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {formatDate(member.joined_at ?? member.invited_at)}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    {isPending ? (
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{
                          borderColor: "var(--color-warning)",
                          color: "var(--color-warning)",
                          borderRadius: "var(--radius-badge)",
                        }}
                      >
                        รอยืนยัน
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{
                          borderColor: "var(--color-success)",
                          color: "var(--color-success)",
                          borderRadius: "var(--radius-badge)",
                        }}
                      >
                        ใช้งานแล้ว
                      </Badge>
                    )}
                  </TableCell>

                  {/* Actions */}
                  {canManage && (
                    <TableCell className="text-right">
                      {!isCurrentUser && (
                        <MemberActions
                          memberId={member.id}
                          currentRole={member.role}
                          workspaceId={workspaceId}
                          memberName={displayName}
                        />
                      )}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
