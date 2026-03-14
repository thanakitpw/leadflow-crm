"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import {
  FileText,
  AlertTriangle,
  Loader2,
  Trash2,
  Copy,
  Edit,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
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
// Category badge config
// ============================================================

const FIXED_CATEGORIES = ["F&B", "คลินิก", "อสังหาฯ", "ทั่วไป"]

const CATEGORY_BADGE_STYLE: Record<string, { bg: string; text: string }> = {
  "F&B": { bg: "#1E3A5F", text: "#FFFFFF" },
  คลินิก: { bg: "#0D9488", text: "#FFFFFF" },
  "อสังหาฯ": { bg: "#D97706", text: "#FFFFFF" },
  ทั่วไป: { bg: "#6B7280", text: "#FFFFFF" },
}

function getCategoryStyle(category: string | null): { bg: string; text: string } {
  if (!category) return { bg: "var(--color-primary-light)", text: "var(--color-primary)" }
  return (
    CATEGORY_BADGE_STYLE[category] ?? {
      bg: "var(--color-primary-light)",
      text: "var(--color-primary)",
    }
  )
}

// ============================================================
// Three-dot dropdown menu
// ============================================================

function TemplateMenu({
  templateId,
  workspaceId,
  canEdit,
  onDuplicate,
  onDelete,
}: {
  templateId: string
  workspaceId: string
  canEdit: boolean
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.preventDefault()
          setOpen((v) => !v)
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-subtle)]"
        aria-label="เมนู"
      >
        <MoreVertical className="h-4 w-4" style={{ color: "var(--color-muted)" }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-8 z-50 min-w-[140px] rounded-xl border bg-white py-1 shadow-lg"
          style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
        >
          <Link
            href={`/${workspaceId}/templates/${templateId}`}
            className="flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-[var(--color-canvas)]"
            style={{ color: "var(--color-ink)" }}
            onClick={() => setOpen(false)}
          >
            <Edit className="h-3.5 w-3.5" />
            แก้ไข
          </Link>
          {canEdit && (
            <>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-[var(--color-canvas)]"
                style={{ color: "var(--color-ink)" }}
                onClick={() => {
                  onDuplicate(templateId)
                  setOpen(false)
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                สำเนา
              </button>
              <div
                className="mx-3 my-1 border-t"
                style={{ borderColor: "var(--color-border)" }}
              />
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-red-50"
                style={{ color: "var(--color-danger)" }}
                onClick={() => {
                  onDelete(templateId)
                  setOpen(false)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                ลบ
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Template Card
// ============================================================

function TemplateCard({
  template,
  workspaceId,
  canEdit,
  onDuplicate,
  onDelete,
}: {
  template: Template
  workspaceId: string
  canEdit: boolean
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}) {
  const badgeStyle = getCategoryStyle(template.category)

  return (
    <div
      className="group relative flex flex-col rounded-xl border bg-white p-5 transition-shadow hover:shadow-md"
      style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
    >
      {/* Top row: badge + menu */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          {template.category ? (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: badgeStyle.bg,
                color: badgeStyle.text,
              }}
            >
              {template.category}
            </span>
          ) : (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: "var(--color-subtle)",
                color: "var(--color-muted)",
              }}
            >
              ไม่มีหมวดหมู่
            </span>
          )}
        </div>
        <TemplateMenu
          templateId={template.id}
          workspaceId={workspaceId}
          canEdit={canEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      </div>

      {/* Template name */}
      <h3
        className="mb-1 line-clamp-1 text-base font-semibold"
        style={{ color: "var(--color-ink)" }}
      >
        {template.name}
      </h3>

      {/* Subject as description */}
      <p
        className="mb-4 line-clamp-2 flex-1 text-[13px] leading-relaxed"
        style={{ color: "var(--color-muted)" }}
      >
        {template.subject}
      </p>

      {/* Stats row */}
      <div
        className="mt-auto grid grid-cols-3 divide-x rounded-lg px-0 py-3"
        style={{
          backgroundColor: "var(--color-canvas)",
          borderRadius: "var(--radius-input)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="flex flex-col items-center gap-0.5 px-2">
          <span className="text-sm font-bold" style={{ color: "var(--color-ink)" }}>
            —
          </span>
          <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>
            Open Rate
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-2">
          <span className="text-sm font-bold" style={{ color: "var(--color-ink)" }}>
            —
          </span>
          <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>
            Click Rate
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-2">
          <span className="text-sm font-bold" style={{ color: "var(--color-ink)" }}>
            —
          </span>
          <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>
            ใช้แล้ว
          </span>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Main Component
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

  // Merge fixed categories with any dynamic ones from DB
  const allCategories = [
    ...FIXED_CATEGORIES,
    ...categories.filter((c) => !FIXED_CATEGORIES.includes(c)),
  ]

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

  const openDeleteDialog = (id: string) => {
    setDeletingId(id)
    setDeleteOpen(true)
  }

  return (
    <div>
      {/* Category filter pills */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {["all", ...allCategories].map((cat) => {
          const isActive = category === cat
          const label = cat === "all" ? "ทั้งหมด" : cat
          return (
            <button
              key={cat}
              onClick={() => {
                setCategory(cat)
                setPage(1)
              }}
              className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
              style={
                isActive
                  ? {
                      backgroundColor: "var(--color-primary)",
                      color: "#FFFFFF",
                      border: "1.5px solid var(--color-primary)",
                    }
                  : {
                      backgroundColor: "#FFFFFF",
                      color: "var(--color-ink)",
                      border: "1.5px solid var(--color-border)",
                    }
              }
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--color-primary)" }} />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <AlertTriangle className="h-8 w-8" style={{ color: "var(--color-danger)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
            {error}
          </p>
          <Button variant="outline" size="sm" onClick={fetchTemplates}>
            ลองใหม่
          </Button>
        </div>
      ) : !data || data.templates.length === 0 ? (
        /* Empty state */
        <div
          className="flex flex-col items-center justify-center gap-4 rounded-xl border bg-white py-24"
          style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
        >
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--color-primary-light)" }}
          >
            <FileText className="h-8 w-8" style={{ color: "var(--color-primary)" }} />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold" style={{ color: "var(--color-ink)" }}>
              ยังไม่มีเทมเพลต
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
              สร้างเทมเพลตแรกเพื่อเริ่มส่ง campaigns
            </p>
          </div>
          {canEdit && (
            <Link href={`/${workspaceId}/templates/new`}>
              <Button
                className="text-white"
                style={{
                  backgroundColor: "var(--color-primary)",
                  borderRadius: "var(--radius-btn)",
                }}
              >
                + สร้างเทมเพลต
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                workspaceId={workspaceId}
                canEdit={canEdit}
                onDuplicate={handleDuplicate}
                onDelete={openDeleteDialog}
              />
            ))}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                style={{ borderRadius: "var(--radius-btn)" }}
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
                style={{ borderRadius: "var(--radius-btn)" }}
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
            <DialogTitle style={{ color: "var(--color-ink)" }}>ยืนยันการลบเทมเพลต</DialogTitle>
            <DialogDescription style={{ color: "var(--color-muted)" }}>
              คุณต้องการลบเทมเพลตนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteLoading}
              style={{ borderRadius: "var(--radius-btn)" }}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="text-white"
              style={{ backgroundColor: "var(--color-danger)", borderRadius: "var(--radius-btn)" }}
            >
              {deleteLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              ลบเทมเพลต
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
