"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2, Save } from "lucide-react"
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
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"

interface WorkspaceGeneralFormProps {
  workspaceId: string
  initialName: string
  canEdit: boolean
  showDeleteOnly?: boolean
}

export default function WorkspaceGeneralForm({
  workspaceId,
  initialName,
  canEdit,
  showDeleteOnly = false,
}: WorkspaceGeneralFormProps) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || name.trim() === initialName) return

    setIsSaving(true)
    try {
      await trpc.workspace.update.mutate({
        workspaceId,
        name: name.trim(),
      })
      toast.success("บันทึกชื่อ workspace สำเร็จ")
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด"
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (deleteConfirm !== initialName) return

    setIsDeleting(true)
    try {
      await trpc.workspace.delete.mutate({ workspaceId })
      toast.success("ลบ workspace สำเร็จ")
      router.push("/")
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด"
      toast.error(msg)
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  if (showDeleteOnly) {
    return (
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            style={{ borderRadius: "var(--radius-btn)" }}
          >
            <Trash2 className="h-4 w-4" />
            ลบ Workspace นี้
          </Button>
        </DialogTrigger>
        <DialogContent style={{ borderRadius: "var(--radius-modal)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--color-danger)" }}>
              ยืนยันการลบ Workspace
            </DialogTitle>
            <DialogDescription style={{ color: "var(--color-muted)" }}>
              การกระทำนี้ไม่สามารถยกเลิกได้ ข้อมูลทั้งหมดของ workspace{" "}
              <strong style={{ color: "var(--color-ink)" }}>
                {initialName}
              </strong>{" "}
              จะถูกลบถาวร
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Label
              htmlFor="delete-confirm"
              className="mb-2 block text-sm"
              style={{ color: "var(--color-ink)" }}
            >
              พิมพ์ชื่อ workspace เพื่อยืนยัน:{" "}
              <strong>{initialName}</strong>
            </Label>
            <Input
              id="delete-confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={initialName}
              style={{ borderRadius: "var(--radius-input)" }}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setDeleteConfirm("")
              }}
              style={{ borderRadius: "var(--radius-btn)" }}
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== initialName || isDeleting}
              onClick={handleDelete}
              className="gap-2"
              style={{ borderRadius: "var(--radius-btn)" }}
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              ลบ Workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <Label
          htmlFor="workspace-name"
          className="mb-1.5 block text-sm font-medium"
          style={{ color: "var(--color-ink)" }}
        >
          ชื่อ Workspace
        </Label>
        <Input
          id="workspace-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!canEdit}
          maxLength={100}
          style={{ borderRadius: "var(--radius-input)" }}
        />
        {!canEdit && (
          <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
            เฉพาะ Admin เท่านั้นที่สามารถแก้ไขได้
          </p>
        )}
      </div>

      {canEdit && (
        <Button
          type="submit"
          disabled={isSaving || !name.trim() || name.trim() === initialName}
          className="gap-2"
          style={{
            backgroundColor: "var(--color-primary)",
            borderRadius: "var(--radius-btn)",
            color: "white",
          }}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          บันทึก
        </Button>
      )}
    </form>
  )
}
