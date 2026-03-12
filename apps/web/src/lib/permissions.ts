/**
 * Role-based permission helpers สำหรับ LeadFlow CRM
 *
 * Roles:
 *   agency_admin   — สิทธิ์เต็ม: จัดการ member, แก้ไข/ลบ workspace
 *   agency_member  — ใช้งานได้ แต่ไม่จัดการ member หรือ workspace
 *   client_viewer  — ดูได้อย่างเดียว ไม่เห็น settings
 */

export type WorkspaceRole = "agency_admin" | "agency_member" | "client_viewer"

/** ตรวจสอบว่า role นี้สามารถเชิญ / แก้ไข / ลบ members ได้หรือไม่ */
export function canManageMembers(role: string): boolean {
  return role === "agency_admin"
}

/** ตรวจสอบว่า role นี้สามารถแก้ไขชื่อ workspace ได้หรือไม่ */
export function canEditWorkspace(role: string): boolean {
  return role === "agency_admin"
}

/** ตรวจสอบว่า role นี้สามารถลบ workspace ได้หรือไม่ */
export function canDeleteWorkspace(role: string): boolean {
  return role === "agency_admin"
}

/** ตรวจสอบว่า role นี้สามารถเข้าถึง settings ได้หรือไม่ */
export function canAccessSettings(role: string): boolean {
  return role === "agency_admin" || role === "agency_member"
}

/** ตรวจสอบว่า role นี้สามารถสร้าง/แก้ไขข้อมูล lead ได้หรือไม่ */
export function canEditLeads(role: string): boolean {
  return role === "agency_admin" || role === "agency_member"
}

/** Label สำหรับแสดง role ในภาษาไทย */
export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    agency_admin: "Admin",
    agency_member: "Member",
    client_viewer: "Viewer",
  }
  return labels[role] ?? role
}
