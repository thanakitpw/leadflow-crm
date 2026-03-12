"use client"

import { useState } from "react"
import { Plus, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { trpc } from "@/lib/trpc/client"

// ============================================================
// Types
// ============================================================

interface Tag {
  id: string
  tag: string
}

interface TagManagerProps {
  workspaceId: string
  leadId: string
  initialTags: Tag[]
  canEdit?: boolean
}

// ============================================================
// Component
// ============================================================

export default function TagManager({
  workspaceId,
  leadId,
  initialTags,
  canEdit = true,
}: TagManagerProps) {
  const [tags, setTags] = useState<Tag[]>(initialTags)
  const [newTag, setNewTag] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAddTag = async () => {
    const tag = newTag.trim()
    if (!tag) return
    if (tags.some((t) => t.tag.toLowerCase() === tag.toLowerCase())) {
      setError(`Tag "${tag}" มีอยู่แล้ว`)
      return
    }

    setIsAdding(true)
    setError(null)
    try {
      const result = await trpc.lead.addTag.mutate({
        workspaceId,
        leadId,
        tag,
      })
      setTags((prev) => [...prev, result as Tag])
      setNewTag("")
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "ไม่สามารถเพิ่ม tag ได้"
      )
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveTag = async (tagId: string) => {
    setRemovingId(tagId)
    setError(null)
    try {
      await trpc.lead.removeTag.mutate({ workspaceId, tagId })
      setTags((prev) => prev.filter((t) => t.id !== tagId))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "ไม่สามารถลบ tag ได้"
      )
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div>
      {/* Tags */}
      <div className="mb-3 flex flex-wrap gap-1.5 min-h-[28px]">
        {tags.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--color-muted)" }}>
            ยังไม่มี tags
          </p>
        ) : (
          tags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium"
              style={{
                backgroundColor: "var(--color-primary-light)",
                color: "var(--color-primary)",
                borderRadius: "9999px",
              }}
            >
              {t.tag}
              {canEdit && (
                <button
                  onClick={() => handleRemoveTag(t.id)}
                  disabled={removingId === t.id}
                  className="ml-0.5 rounded-full transition-colors hover:opacity-60"
                  aria-label={`ลบ tag ${t.tag}`}
                >
                  {removingId === t.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </button>
              )}
            </span>
          ))
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="mb-2 text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}

      {/* Add Tag Input */}
      {canEdit && (
        <div className="flex gap-2">
          <Input
            placeholder="เพิ่ม tag..."
            value={newTag}
            onChange={(e) => {
              setNewTag(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void handleAddTag()
              }
            }}
            className="h-8 flex-1 text-xs"
            style={{
              borderRadius: "var(--radius-input)",
              borderColor: "var(--color-border)",
            }}
          />
          <Button
            size="sm"
            onClick={() => void handleAddTag()}
            disabled={isAdding || !newTag.trim()}
            className="h-8 px-3"
            style={{
              backgroundColor: "var(--color-primary)",
              borderRadius: "var(--radius-btn)",
            }}
          >
            {isAdding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
