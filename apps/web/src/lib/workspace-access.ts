import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

/**
 * ตรวจสอบว่า user ที่ login อยู่เป็น member ของ workspace นี้หรือไม่
 * ถ้าไม่ได้ login → redirect ไป /login
 * ถ้าไม่ได้เป็น member → redirect ไป /dashboard
 */
export async function requireWorkspaceAccess(workspaceId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single()

  if (!member) redirect("/")

  return { user, role: member.role as string }
}

/**
 * ตรวจสอบว่า user เป็น agency_admin ของ workspace นี้หรือไม่
 * ถ้าไม่ใช่ admin → redirect ไป /dashboard
 */
export async function requireWorkspaceAdmin(workspaceId: string) {
  const { user, role } = await requireWorkspaceAccess(workspaceId)

  if (role !== "agency_admin") redirect("/")

  return { user, role }
}
