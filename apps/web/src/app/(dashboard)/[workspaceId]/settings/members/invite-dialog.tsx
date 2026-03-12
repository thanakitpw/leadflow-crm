"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { UserPlus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"

interface InviteMemberDialogProps {
  workspaceId: string
}

type Role = "agency_admin" | "agency_member" | "client_viewer"

const ROLE_OPTIONS: { value: Role; label: string; description: string }[] = [
  {
    value: "agency_admin",
    label: "Admin",
    description: "สิทธิ์เต็ม จัดการ members และ workspace ได้",
  },
  {
    value: "agency_member",
    label: "Member",
    description: "ใช้งานระบบได้ แต่ไม่จัดการ members",
  },
  {
    value: "client_viewer",
    label: "Viewer",
    description: "ดูข้อมูลได้อย่างเดียว",
  },
]

export default function InviteMemberDialog({
  workspaceId,
}: InviteMemberDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Role>("agency_member")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(val: boolean) {
    setOpen(val)
    if (!val) {
      setEmail("")
      setRole("agency_member")
      setError(null)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setError("กรุณากรอก email")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("รูปแบบ email ไม่ถูกต้อง")
      return
    }

    setIsLoading(true)
    try {
      const result = await trpc.member.invite.mutate({
        workspaceId,
        email: trimmed,
        role,
      })

      const label = result.isExistingUser
        ? "เพิ่มสมาชิกสำเร็จ"
        : "ส่งคำเชิญสำเร็จ — รอผู้ใช้ยืนยันอีเมล"
      toast.success(label)
      setOpen(false)
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด"
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          className="gap-2"
          style={{
            backgroundColor: "var(--color-primary)",
            color: "white",
            borderRadius: "var(--radius-btn)",
          }}
        >
          <UserPlus className="h-4 w-4" />
          เชิญสมาชิก
        </Button>
      </DialogTrigger>

      <DialogContent style={{ borderRadius: "var(--radius-modal)" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "var(--color-ink)" }}>
            เชิญสมาชิกใหม่
          </DialogTitle>
          <DialogDescription style={{ color: "var(--color-muted)" }}>
            กรอก email และเลือก role สำหรับสมาชิกที่ต้องการเชิญ
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleInvite} className="space-y-4 py-2">
          {/* Email */}
          <div>
            <Label
              htmlFor="invite-email"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: "var(--color-ink)" }}
            >
              Email
            </Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError(null)
              }}
              placeholder="example@company.com"
              autoComplete="off"
              style={{ borderRadius: "var(--radius-input)" }}
            />
          </div>

          {/* Role */}
          <div>
            <Label
              htmlFor="invite-role"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: "var(--color-ink)" }}
            >
              Role
            </Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger
                id="invite-role"
                style={{ borderRadius: "var(--radius-input)" }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ borderRadius: "var(--radius-card)" }}>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div>
                      <span className="font-medium">{opt.label}</span>
                      <span
                        className="ml-2 text-xs"
                        style={{ color: "var(--color-muted)" }}
                      >
                        — {opt.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Error */}
          {error && (
            <p
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                backgroundColor: "#FEF2F2",
                color: "var(--color-danger)",
                borderRadius: "var(--radius-input)",
              }}
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              style={{ borderRadius: "var(--radius-btn)" }}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="gap-2"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "white",
                borderRadius: "var(--radius-btn)",
              }}
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              ส่งคำเชิญ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
