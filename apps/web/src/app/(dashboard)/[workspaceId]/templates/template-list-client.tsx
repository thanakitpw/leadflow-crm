"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  FileText,
  AlertTriangle,
  Loader2,
  Trash2,
  Copy,
  Edit,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"

// ============================================================
// Types
// ============================================================

interface Template {
  id: string
  name: string
  subject: string
  category: string | null
  created_at: string
  updated_at: string
}

interface ListResult {
  templates: Template[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface Props {
  workspaceId: string
  canEdit: boolean
  categories: string[]
  initialCategory?: string
  initialPage?: number
}

// ============================================================
// Component
// ============================================================

export default function TemplateListClient({
  workspaceId,
  canEdit,
  categories,
  initialCategory,
  initialPage = 1,
}: Props) {
  const [category, setCategory] = useState<string>(initialCategory ?? "all")
  const [page, setPage] = useState(initialPage)

  const [data, setData] = useState<ListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await trpc.template.list.query({
        workspaceId,
        category: category !== "all" ? category : undefined,
        page,
        pageSize: 12,
      })
      setData(result as ListResult)
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถดึงข้อมูล templates ได้"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [workspaceId, category, page])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleDelete = async () => {
    if (!deletingId) return
    setDeleteLoading(true)
    try {
      await trpc.template.delete.mutate({ workspaceId, templateId: deletingId })
      toast.success("ลบ template แล้ว")
      setDeleteOpen(false)
      setDeletingId(null)
      fetchTemplates()
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถลบ template ได้"
      toast.error(msg)
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleDuplicate = async (templateId: string) => {
    try {
      await trpc.template.duplicate.mutate({ workspaceId, templateId })
      toast.success("สำเนา template แล้ว")
      fetchTemplates()
    } catch {
      toast.error("ไม่สามารถสำเนา template ได้")
    }
  }

  return (
    <div>
      {/* Filter */}
      <div
        className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-white px-5 py-4"
        style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
      >
        <Filter className="h-4 w-4 shrink-0" style={{ color: "var(--color-muted)" }} />
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="หมวดหมู่" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">หมวดหมู่: ทั้งหมด</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--color-primary)" }} />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20">
          <AlertTriangle className="h-8 w-8" style={{ color: "#DC2626" }} />
          <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
            {error}
          </p>
          <Button variant="outline" size="sm" onClick={fetchTemplates}>
            ลองใหม่
          </Button>
        </div>
      ) : !data || data.templates.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-white py-20"
          style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--color-primary-light)" }}
          >
            <FileText className="h-7 w-7" style={{ color: "var(--color-primary)" }} />
          </div>
          <p className="font-medium" style={{ color: "var(--color-ink)" }}>
            ยังไม่มี templates
          </p>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            สร้าง template แรกเพื่อเริ่มส่ง campaigns
          </p>
        </div>
      ) : (
        <>
          {/* Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.templates.map((template) => (
              <div
                key={template.id}
                className="group relative rounded-xl border bg-white p-5 transition-shadow hover:shadow-md"
                style={{
                  borderColor: "var(--color-border)",
                  borderRadius: "var(--radius-card)",
                }}
              >
                {/* Category badge */}
                {template.category && (
                  <span
                    className="mb-3 inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: "var(--color-primary-light)",
                      color: "var(--color-primary)",
                      borderRadius: "var(--radius-badge)",
                    }}
                  >
                    {template.category}
                  </span>
                )}

                {/* ชื่อ */}
                <h3
                  className="mb-1 truncate font-semibold"
                  style={{ color: "var(--color-ink)" }}
                >
                  {template.name}
                </h3>

                {/* Subject */}
                <p
                  className="mb-4 truncate text-sm"
                  style={{ color: "var(--color-muted)" }}
                >
                  {template.subject}
                </p>

                {/* วันที่ */}
                <p className="mb-4 text-xs" style={{ color: "var(--color-muted)" }}>
                  แก้ไขล่าสุด{" "}
                  {new Date(template.updated_at).toLocaleDateString("th-TH", {
                    day: "numeric",
                    month: "short",
                    year: "2-digit",
                  })}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Link href={`/${workspaceId}/templates/${template.id}`} className="flex-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5 text-xs"
                      style={{ borderRadius: "var(--radius-btn)" }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                      แก้ไข
                    </Button>
                  </Link>
                  {canEdit && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleDuplicate(template.id)}
                        title="สำเนา"
                        style={{ borderRadius: "var(--radius-btn)" }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setDeletingId(template.id)
                          setDeleteOpen(true)
                        }}
                        title="ลบ"
                        style={{
                          borderRadius: "var(--radius-btn)",
                          color: "var(--color-danger)",
                          borderColor: "var(--color-danger)",
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                {page} / {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent style={{ borderRadius: "var(--radius-modal)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--color-ink)" }}>ยืนยันการลบ Template</DialogTitle>
            <DialogDescription style={{ color: "var(--color-muted)" }}>
              คุณต้องการลบ template นี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteLoading}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleteLoading}
              style={{ backgroundColor: "var(--color-danger)", borderRadius: "var(--radius-btn)" }}
            >
              {deleteLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              ลบ Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
