"use client"

import { useState, useEffect, useRef } from "react"
import { Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc/client"

// ============================================================
// Types
// ============================================================

interface NotesEditorProps {
  workspaceId: string
  leadId: string
  initialNotes?: string | null
  canEdit?: boolean
}

// Auto-save delay in ms
const AUTO_SAVE_DELAY = 2000

// ============================================================
// Component
// ============================================================

export default function NotesEditor({
  workspaceId,
  leadId,
  initialNotes,
  canEdit = true,
}: NotesEditorProps) {
  const [notes, setNotes] = useState(initialNotes ?? "")
  const [isSaving, setIsSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveNotes = async (value: string) => {
    setIsSaving(true)
    setError(null)
    try {
      await trpc.lead.update.mutate({
        workspaceId,
        leadId,
        notes: value,
      })
      setSavedAt(new Date())
      setIsDirty(false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "ไม่สามารถบันทึก notes ได้"
      )
    } finally {
      setIsSaving(false)
    }
  }

  // Auto-save when notes change
  useEffect(() => {
    if (!isDirty) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      void saveNotes(notes)
    }, AUTO_SAVE_DELAY)
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [notes, isDirty]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value)
    setIsDirty(true)
    setSavedAt(null)
  }

  const handleManualSave = () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    void saveNotes(notes)
  }

  return (
    <div>
      {/* Textarea */}
      <textarea
        value={notes}
        onChange={handleChange}
        placeholder="บันทึกข้อมูลเพิ่มเติม เช่น รายละเอียดการติดต่อ, จุดสนใจ, ข้อสังเกต..."
        rows={5}
        disabled={!canEdit}
        className="w-full resize-none border p-3 text-sm outline-none transition-colors"
        style={{
          borderColor: "var(--color-border)",
          borderRadius: "var(--radius-input)",
          color: "var(--color-ink)",
          backgroundColor: canEdit ? "white" : "var(--color-canvas)",
          lineHeight: "1.6",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--color-primary)"
          e.currentTarget.style.boxShadow = "0 0 0 1px var(--color-primary)"
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--color-border)"
          e.currentTarget.style.boxShadow = "none"
        }}
      />

      {/* Footer: auto-save indicator + manual save button */}
      {canEdit && (
        <div className="mt-2 flex items-center justify-between">
          {/* Auto-save indicator */}
          <div className="flex items-center gap-1.5 text-xs">
            {isSaving && (
              <>
                <Loader2
                  className="h-3.5 w-3.5 animate-spin"
                  style={{ color: "var(--color-muted)" }}
                />
                <span style={{ color: "var(--color-muted)" }}>
                  กำลังบันทึก...
                </span>
              </>
            )}
            {!isSaving && savedAt && !isDirty && (
              <>
                <Check
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--color-success)" }}
                />
                <span style={{ color: "var(--color-success)" }}>
                  บันทึกแล้ว{" "}
                  {savedAt.toLocaleTimeString("th-TH", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </>
            )}
            {!isSaving && isDirty && (
              <span style={{ color: "var(--color-warning)" }}>
                ยังไม่ได้บันทึก
              </span>
            )}
            {error && (
              <span style={{ color: "var(--color-danger)" }}>{error}</span>
            )}
          </div>

          {/* Manual save button */}
          <Button
            size="sm"
            onClick={handleManualSave}
            disabled={isSaving || (!isDirty && savedAt !== null)}
            className="h-8 text-xs"
            style={{
              backgroundColor: "var(--color-primary)",
              borderRadius: "var(--radius-btn)",
            }}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              "บันทึก"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
