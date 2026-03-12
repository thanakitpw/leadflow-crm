"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Shield, ShieldCheck, Eye, Trash2, Loader2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"

interface MemberActionsProps {
  memberId: string
  currentRole: string
  workspaceId: string
  memberName: string
}

type Role = "agency_admin" | "agency_member" | "client_viewer"

const ROLES: { value: Role; label: string; icon: React.ElementType }[] = [
  { value: "agency_admin", label: "Admin", icon: ShieldCheck },
  { value: "agency_member", label: "Member", icon: Shield },
  { value: "client_viewer", label: "Viewer", icon: Eye },
]

export default function MemberActions({
  memberId,
  currentRole,
  workspaceId,
  memberName,
}: MemberActionsProps) {
  const router = useRouter()
  const [isChangingRole, setIsChangingRole] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  async function handleChangeRole(newRole: Role) {
    if (newRole === currentRole) return
    setIsChangingRole(true)
    try {
      await trpc.member.updateRole.mutate({
        workspaceId,
        memberId,
        role: newRole,
      })
      toast.success(`เปลี่ยน role เป็น ${ROLES.find((r) => r.value === newRole)?.label} สำเร็จ`)
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด"
      toast.error(msg)
    } finally {
      setIsChangingRole(false)
    }
  }

  async function handleRemove() {
    setIsRemoving(true)
    try {
      await trpc.member.remove.mutate({ workspaceId, memberId })
      toast.success(`นำ ${memberName} ออกจาก workspace แล้ว`)
      setRemoveDialogOpen(false)
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด"
      toast.error(msg)
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={isChangingRole}
            className="h-8 w-8"
            style={{ borderRadius: "var(--radius-btn)" }}
          >
            {isChangingRole ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          style={{ borderRadius: "var(--radius-card)" }}
        >
          {/* Role options */}
          {ROLES.filter((r) => r.value !== currentRole).map(
            ({ value, label, icon: Icon }) => (
              <DropdownMenuItem
                key={value}
                className="cursor-pointer gap-2"
                onClick={() => handleChangeRole(value)}
              >
                <Icon className="h-4 w-4" />
                เปลี่ยนเป็น {label}
              </DropdownMenuItem>
            )
          )}

          <DropdownMenuSeparator />

          {/* Remove */}
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            style={{ color: "var(--color-danger)" }}
            onClick={() => setRemoveDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            นำออกจาก workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Remove confirm dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent style={{ borderRadius: "var(--radius-modal)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--color-ink)" }}>
              นำสมาชิกออก
            </DialogTitle>
            <DialogDescription style={{ color: "var(--color-muted)" }}>
              คุณต้องการนำ{" "}
              <strong style={{ color: "var(--color-ink)" }}>{memberName}</strong>{" "}
              ออกจาก workspace นี้ใช่หรือไม่? พวกเขาจะไม่สามารถเข้าถึงข้อมูลได้อีก
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveDialogOpen(false)}
              style={{ borderRadius: "var(--radius-btn)" }}
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              disabled={isRemoving}
              onClick={handleRemove}
              className="gap-2"
              style={{ borderRadius: "var(--radius-btn)" }}
            >
              {isRemoving && <Loader2 className="h-4 w-4 animate-spin" />}
              นำออก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
