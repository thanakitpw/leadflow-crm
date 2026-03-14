"use client"

import { useState, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import {
  MapPin,
  Search,
  Phone,
  Globe,
  Building2,
  Loader2,
  Save,
  ChevronsUpDown,
  Check,
  Sparkles,
  LayoutList,
  LayoutGrid,
  Download,
  AlertCircle,
  Star,
  Facebook,
  MessageCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { trpc } from "@/lib/trpc/client"
import { PROVINCES } from "@/lib/thai-provinces"

// ============================================================
// Types
// ============================================================

interface PlaceResult {
  place_id: string
  name: string
  address: string
  phone?: string
  website?: string
  rating?: number
  review_count?: number
  category?: string
  latitude?: number
  longitude?: number
  cached?: boolean
}

interface SocialLink {
  platform: string
  url: string | null
  handle: string | null
  source: string
  confidence: number
}

interface EnrichedResult extends PlaceResult {
  email?: string
  emailConfidence?: number
  emailSource?: string
  isEnriching?: boolean
  enrichFailed?: boolean
  score?: number
  // Social media fields
  facebook?: SocialLink | null
  line?: SocialLink | null
  isSocialEnriching?: boolean
  socialEnrichFailed?: boolean
}

interface SearchResponse {
  results: PlaceResult[]
  cached: boolean
  total: number
}

// ============================================================
// Constants
// ============================================================

const CATEGORIES = ["F&B", "SME", "อสังหาฯ", "B2B"] as const
type Category = (typeof CATEGORIES)[number]

const SUB_CATEGORIES: Record<Category, string[]> = {
  "F&B": ["ร้านอาหาร", "คาเฟ่", "โรงแรม", "บาร์", "เบเกอรี่", "ฟาสต์ฟู้ด"],
  SME: ["ร้านค้าปลีก", "บริการ", "ช่าง/ซ่อม", "ความงาม", "สุขภาพ"],
  "อสังหาฯ": ["คอนโด", "บ้านจัดสรร", "ที่ดิน", "อพาร์ทเมนท์", "ออฟฟิศ"],
  B2B: ["IT/Software", "การตลาด", "ที่ปรึกษา", "โรงงาน", "โลจิสติกส์"],
}

const MAX_RESULTS_OPTIONS = [10, 20, 40, 60]

const RADIUS_OPTIONS = [
  { label: "500ม.", value: 500 },
  { label: "1กม.", value: 1000 },
  { label: "2กม.", value: 2000 },
  { label: "5กม.", value: 5000 },
  { label: "10กม.", value: 10000 },
]

const AVATAR_COLORS = [
  { bg: "#FEE2E2", text: "#DC2626" },
  { bg: "#FEF3C7", text: "#D97706" },
  { bg: "#DBEAFE", text: "#2563EB" },
  { bg: "#F0FDF4", text: "#16A34A" },
  { bg: "#EDE9FE", text: "#7C3AED" },
  { bg: "#FCE7F3", text: "#DB2777" },
]

const LEAD_TEMPERATURE = [
  { label: "ลีดร้อน", min: 75, bg: "#FEE2E2", color: "#DC2626" },
  { label: "ลีดอุ่น", min: 50, bg: "#FEF3C7", color: "#D97706" },
  { label: "ลีดเย็น", min: 0, bg: "#DBEAFE", color: "#2563EB" },
]

const ENRICHMENT_CONCURRENCY = 3

// ============================================================
// Helper functions
// ============================================================

function getAvatarColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function getLeadTemperature(score?: number) {
  if (score == null) return null
  return (
    LEAD_TEMPERATURE.find((t) => score >= t.min) ??
    LEAD_TEMPERATURE[LEAD_TEMPERATURE.length - 1]
  )
}

// ============================================================
// Sub-components
// ============================================================

function StarRating({ rating }: { rating: number | null | undefined }) {
  if (rating == null) return null
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className="h-3 w-3"
          style={{
            fill: star <= Math.round(rating) ? "#D97706" : "transparent",
            color: star <= Math.round(rating) ? "#D97706" : "#E5DDD6",
          }}
        />
      ))}
      <span className="ml-1 text-[11px]" style={{ color: "var(--color-muted)" }}>
        {rating.toFixed(1)}
      </span>
    </span>
  )
}

function LeadListRow({
  result,
  index,
  selected,
  onToggle,
}: {
  result: EnrichedResult
  index: number
  selected: boolean
  onToggle: () => void
}) {
  const avatar = getAvatarColor(index)
  const initials = getInitials(result.name)
  const temp = getLeadTemperature(result.score)

  return (
    <div
      className="flex items-center gap-3 rounded-xl border bg-white px-4 py-3 transition-all"
      style={{
        borderColor: selected ? "var(--color-primary)" : "var(--color-border)",
        borderWidth: selected ? "1.5px" : "1px",
        backgroundColor: result.isEnriching
          ? "#FFFBEB"
          : selected
            ? "var(--color-primary-light)"
            : "white",
        borderRadius: "var(--radius-card)",
      }}
    >
      {/* Checkbox */}
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
        id={`lead-${result.place_id}`}
      />

      {/* Avatar */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
        style={{ backgroundColor: avatar.bg, color: avatar.text }}
      >
        {initials}
      </div>

      {/* Info */}
      <label
        htmlFor={`lead-${result.place_id}`}
        className="min-w-0 flex-1 cursor-pointer"
      >
        {/* Row 1: name + badge */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>
            {result.name}
          </span>
          {temp && (
            <span
              className="rounded px-1.5 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: temp.bg,
                color: temp.color,
                borderRadius: "var(--radius-badge)",
              }}
            >
              {temp.label}
            </span>
          )}
        </div>

        {/* Row 2: category · location · email */}
        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs" style={{ color: "var(--color-muted)" }}>
          {result.category && <span>{result.category}</span>}
          {result.category && result.address && (
            <span className="mx-0.5">·</span>
          )}
          {result.address && (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="max-w-[180px] truncate">{result.address}</span>
            </span>
          )}
          {result.email && (
            <>
              <span className="mx-0.5">·</span>
              <a
                href={`mailto:${result.email}`}
                className="hover:underline"
                style={{ color: "var(--color-info)" }}
                onClick={(e) => e.stopPropagation()}
              >
                {result.email}
              </a>
            </>
          )}
          {result.isEnriching && !result.email && (
            <>
              <span className="mx-0.5">·</span>
              <span className="flex items-center gap-1" style={{ color: "var(--color-warning)" }}>
                <Loader2 className="h-3 w-3 animate-spin" />
                กำลังค้นหาอีเมล...
              </span>
            </>
          )}
          {result.enrichFailed && !result.email && !result.isEnriching && (
            <>
              <span className="mx-0.5">·</span>
              <span style={{ color: "var(--color-muted)" }}>ไม่พบอีเมล</span>
            </>
          )}
        </div>

        {/* Row 3: rating + phone + website */}
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          {result.rating != null && <StarRating rating={result.rating} />}
          {result.phone && (
            <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--color-muted)" }}>
              <Phone className="h-3 w-3" />
              {result.phone}
            </span>
          )}
          {result.website && (
            <a
              href={result.website.startsWith("http") ? result.website : `https://${result.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] hover:underline"
              style={{ color: "var(--color-info)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <Globe className="h-3 w-3" />
              {result.website.replace(/^https?:\/\//, "").split("/")[0]}
            </a>
          )}
        </div>

        {/* Row 4: Social links */}
        {(result.facebook || result.line || result.isSocialEnriching) && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {result.isSocialEnriching && !result.facebook && !result.line && (
              <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--color-warning)" }}>
                <Loader2 className="h-3 w-3 animate-spin" />
                กำลังค้นหาโซเชียล...
              </span>
            )}
            {result.facebook?.url && (
              <a
                href={result.facebook.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] hover:underline"
                style={{ color: "#1877F2" }}
                onClick={(e) => e.stopPropagation()}
                title={`Facebook: ${result.facebook.handle ?? result.facebook.url}`}
              >
                <Facebook className="h-3 w-3" />
                {result.facebook.handle ?? "Facebook Page"}
              </a>
            )}
            {result.line?.url && (
              <a
                href={result.line.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] hover:underline"
                style={{ color: "#06C755" }}
                onClick={(e) => e.stopPropagation()}
                title={`LINE: ${result.line.handle ?? result.line.url}`}
              >
                <MessageCircle className="h-3 w-3" />
                {result.line.handle ?? "LINE OA"}
              </a>
            )}
          </div>
        )}
      </label>

      {/* Score */}
      <div className="ml-auto flex shrink-0 flex-col items-end gap-1.5">
        <div className="flex items-baseline gap-0.5">
          {result.score != null ? (
            <>
              <span className="text-lg font-bold" style={{ color: "var(--color-ink)" }}>
                {result.score}
              </span>
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                /100
              </span>
            </>
          ) : (
            <span className="text-base font-medium" style={{ color: "var(--color-muted)" }}>
              —
            </span>
          )}
        </div>
        <button
          className="rounded px-2 py-0.5 text-[11px] font-medium transition-colors"
          style={{
            backgroundColor: "var(--color-primary-light)",
            color: "var(--color-primary)",
            borderRadius: "var(--radius-badge)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          Assign
        </button>
      </div>
    </div>
  )
}

function LeadGridCard({
  result,
  index,
  selected,
  onToggle,
}: {
  result: EnrichedResult
  index: number
  selected: boolean
  onToggle: () => void
}) {
  const avatar = getAvatarColor(index)
  const initials = getInitials(result.name)
  const temp = getLeadTemperature(result.score)

  return (
    <div
      className="rounded-xl border bg-white p-4 transition-all"
      style={{
        borderColor: selected ? "var(--color-primary)" : "var(--color-border)",
        borderWidth: selected ? "1.5px" : "1px",
        backgroundColor: result.isEnriching
          ? "#FFFBEB"
          : selected
            ? "var(--color-primary-light)"
            : "white",
        borderRadius: "var(--radius-card)",
      }}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            id={`grid-${result.place_id}`}
          />
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold"
            style={{ backgroundColor: avatar.bg, color: avatar.text }}
          >
            {initials}
          </div>
        </div>
        {result.score != null && (
          <div className="flex items-baseline gap-0.5">
            <span className="text-lg font-bold" style={{ color: "var(--color-ink)" }}>
              {result.score}
            </span>
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>
              /100
            </span>
          </div>
        )}
      </div>

      <label htmlFor={`grid-${result.place_id}`} className="block cursor-pointer">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>
            {result.name}
          </span>
          {temp && (
            <span
              className="rounded px-1.5 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: temp.bg,
                color: temp.color,
                borderRadius: "var(--radius-badge)",
              }}
            >
              {temp.label}
            </span>
          )}
        </div>

        {result.category && (
          <p className="mb-1 text-xs" style={{ color: "var(--color-muted)" }}>
            {result.category}
          </p>
        )}

        {result.address && (
          <div className="mb-1 flex items-start gap-1 text-xs" style={{ color: "var(--color-muted)" }}>
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="line-clamp-2">{result.address}</span>
          </div>
        )}

        {result.email && (
          <a
            href={`mailto:${result.email}`}
            className="mt-1 block truncate text-xs hover:underline"
            style={{ color: "var(--color-info)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {result.email}
          </a>
        )}
        {result.isEnriching && !result.email && (
          <span className="mt-1 flex items-center gap-1 text-xs" style={{ color: "var(--color-warning)" }}>
            <Loader2 className="h-3 w-3 animate-spin" />
            กำลังค้นหาอีเมล...
          </span>
        )}
        {result.enrichFailed && !result.email && !result.isEnriching && (
          <span className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
            ไม่พบอีเมล
          </span>
        )}

        {/* Social links */}
        {(result.facebook || result.line || result.isSocialEnriching) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {result.isSocialEnriching && !result.facebook && !result.line && (
              <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--color-warning)" }}>
                <Loader2 className="h-3 w-3 animate-spin" />
                ค้นหาโซเชียล...
              </span>
            )}
            {result.facebook?.url && (
              <a
                href={result.facebook.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] hover:underline"
                style={{ color: "#1877F2" }}
                onClick={(e) => e.stopPropagation()}
                title={`Facebook: ${result.facebook.handle ?? result.facebook.url}`}
              >
                <Facebook className="h-3 w-3" />
                {result.facebook.handle ?? "Facebook"}
              </a>
            )}
            {result.line?.url && (
              <a
                href={result.line.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] hover:underline"
                style={{ color: "#06C755" }}
                onClick={(e) => e.stopPropagation()}
                title={`LINE: ${result.line.handle ?? result.line.url}`}
              >
                <MessageCircle className="h-3 w-3" />
                {result.line.handle ?? "LINE OA"}
              </a>
            )}
          </div>
        )}
      </label>
    </div>
  )
}

// ============================================================
// Main Page
// ============================================================

export default function LeadSearchPage() {
  const params = useParams<{ workspaceId: string }>()
  const workspaceId = params.workspaceId

  // Form state
  const [selectedCategory, setSelectedCategory] = useState<Category>("F&B")
  const [selectedSubCategories, setSelectedSubCategories] = useState<Set<string>>(new Set())
  const [keyword, setKeyword] = useState("")
  const [provinceKey, setProvinceKey] = useState<string>("bangkok")
  const [selectedDistricts, setSelectedDistricts] = useState<Set<number>>(new Set())
  const [provinceOpen, setProvinceOpen] = useState(false)
  const [radius, setRadius] = useState(2000)
  const [maxResults, setMaxResults] = useState(20)

  // Enrichment options
  const [enrichEmail, setEnrichEmail] = useState(true)
  const [enrichScore, setEnrichScore] = useState(false)
  const [enrichSocial, setEnrichSocial] = useState(false)
  const [onlyWithWebsite, setOnlyWithWebsite] = useState(false)

  // View
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")

  // Results state
  const [results, setResults] = useState<EnrichedResult[] | undefined>(undefined)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSearching, setIsSearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [enrichingCount, setEnrichingCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [saveResult, setSaveResult] = useState<{ created: number; skipped: number } | null>(null)

  // Ref for stable result update during enrichment
  const resultsRef = useRef<EnrichedResult[]>([])

  const province = PROVINCES[provinceKey]
  const firstSelected = selectedDistricts.size > 0 ? Array.from(selectedDistricts)[0] : null
  const selectedDistrict = firstSelected !== null ? province.districts[firstSelected] : null
  const lat = selectedDistrict?.lat ?? province.lat
  const lng = selectedDistrict?.lng ?? province.lng

  const locationLabel = selectedDistrict
    ? `${selectedDistrict.label}, ${province.label}`
    : province.label

  const toggleDistrict = (idx: number) => {
    setSelectedDistricts((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const handleCategorySelect = (cat: Category) => {
    setSelectedCategory(cat)
    setSelectedSubCategories(new Set())
    setKeyword(SUB_CATEGORIES[cat][0] ?? "")
  }

  const handleToggleAllSubCategories = () => {
    const all = SUB_CATEGORIES[selectedCategory]
    if (selectedSubCategories.size === all.length) {
      setSelectedSubCategories(new Set())
      setKeyword("")
    } else {
      setSelectedSubCategories(new Set(all))
      setKeyword(all.join(" "))
    }
  }

  const handleSubCategoryToggle = (sub: string) => {
    setSelectedSubCategories((prev) => {
      const next = new Set(prev)
      if (next.has(sub)) next.delete(sub)
      else next.add(sub)
      setKeyword(Array.from(next).join(" "))
      return next
    })
  }

  // ============================================================
  // Auto Enrichment
  // ============================================================

  const runEnrichment = useCallback(async (places: PlaceResult[]) => {
    const pythonApiUrl = process.env.NEXT_PUBLIC_PYTHON_API_URL ?? "http://localhost:8000"

    // Only enrich places that have a website
    const toEnrich = places.filter((p) => p.website)
    if (toEnrich.length === 0) return

    // Mark all as enriching
    setResults((prev) => {
      if (!prev) return prev
      const updated = prev.map((r) =>
        r.website ? { ...r, isEnriching: true } : r
      )
      resultsRef.current = updated
      return updated
    })
    setEnrichingCount(toEnrich.length)

    // Process with concurrency limit
    let activeCount = 0
    let index = 0
    let remaining = toEnrich.length

    const processNext = async () => {
      if (index >= toEnrich.length) return
      const place = toEnrich[index++]
      activeCount++

      try {
        const res = await fetch(`${pythonApiUrl}/api/v1/enrichment/find-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ website: place.website }),
        })

        if (res.ok) {
          const data = await res.json() as {
            emails?: Array<{ email: string; confidence: number; source: string }>
          }
          const topEmail = data.emails?.[0]

          setResults((prev) => {
            if (!prev) return prev
            const updated = prev.map((r) =>
              r.place_id === place.place_id
                ? {
                    ...r,
                    isEnriching: false,
                    email: topEmail?.email,
                    emailConfidence: topEmail?.confidence,
                    emailSource: topEmail?.source,
                    enrichFailed: !topEmail?.email,
                  }
                : r
            )
            resultsRef.current = updated
            return updated
          })
        } else {
          setResults((prev) => {
            if (!prev) return prev
            const updated = prev.map((r) =>
              r.place_id === place.place_id
                ? { ...r, isEnriching: false, enrichFailed: true }
                : r
            )
            resultsRef.current = updated
            return updated
          })
        }
      } catch {
        setResults((prev) => {
          if (!prev) return prev
          const updated = prev.map((r) =>
            r.place_id === place.place_id
              ? { ...r, isEnriching: false, enrichFailed: true }
              : r
          )
          resultsRef.current = updated
          return updated
        })
      } finally {
        activeCount--
        remaining--
        setEnrichingCount((c) => Math.max(0, c - 1))

        // Start next in queue
        if (index < toEnrich.length && activeCount < ENRICHMENT_CONCURRENCY) {
          void processNext()
        }
      }
    }

    // Start initial batch
    const initialBatch = Math.min(ENRICHMENT_CONCURRENCY, toEnrich.length)
    for (let i = 0; i < initialBatch; i++) {
      void processNext()
    }
  }, [])

  // ============================================================
  // Social Media Enrichment
  // ============================================================

  const runSocialEnrichment = useCallback(async (places: PlaceResult[]) => {
    const pythonApiUrl = process.env.NEXT_PUBLIC_PYTHON_API_URL ?? "http://localhost:8000"

    // เฉพาะ places ที่มี website เท่านั้น
    const toEnrich = places.filter((p) => p.website)
    if (toEnrich.length === 0) return

    // Mark ทั้งหมดว่ากำลัง enrich social
    setResults((prev) => {
      if (!prev) return prev
      const updated = prev.map((r) =>
        r.website ? { ...r, isSocialEnriching: true } : r
      )
      resultsRef.current = updated
      return updated
    })

    let activeCount = 0
    let index = 0

    const processNext = async () => {
      if (index >= toEnrich.length) return
      const place = toEnrich[index++]
      activeCount++

      try {
        const res = await fetch(`${pythonApiUrl}/api/v1/social/find`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ website: place.website }),
        })

        if (res.ok) {
          const data = await res.json() as {
            facebook?: SocialLink | null
            line?: SocialLink | null
          }

          setResults((prev) => {
            if (!prev) return prev
            const updated = prev.map((r) =>
              r.place_id === place.place_id
                ? {
                    ...r,
                    isSocialEnriching: false,
                    facebook: data.facebook ?? null,
                    line: data.line ?? null,
                    socialEnrichFailed: !data.facebook && !data.line,
                  }
                : r
            )
            resultsRef.current = updated
            return updated
          })
        } else {
          setResults((prev) => {
            if (!prev) return prev
            const updated = prev.map((r) =>
              r.place_id === place.place_id
                ? { ...r, isSocialEnriching: false, socialEnrichFailed: true }
                : r
            )
            resultsRef.current = updated
            return updated
          })
        }
      } catch {
        setResults((prev) => {
          if (!prev) return prev
          const updated = prev.map((r) =>
            r.place_id === place.place_id
              ? { ...r, isSocialEnriching: false, socialEnrichFailed: true }
              : r
          )
          resultsRef.current = updated
          return updated
        })
      } finally {
        activeCount--

        if (index < toEnrich.length && activeCount < ENRICHMENT_CONCURRENCY) {
          void processNext()
        }
      }
    }

    const initialBatch = Math.min(ENRICHMENT_CONCURRENCY, toEnrich.length)
    for (let i = 0; i < initialBatch; i++) {
      void processNext()
    }
  }, [])

  // ============================================================
  // Search
  // ============================================================

  const handleSearch = useCallback(async () => {
    const searchKeyword = keyword.trim() || Array.from(selectedSubCategories).join(" ") || selectedCategory
    if (!searchKeyword) return

    setIsSearching(true)
    setResults(undefined)
    setSelectedIds(new Set())
    setErrorMsg(null)
    setSaveResult(null)
    setEnrichingCount(0)

    try {
      const pythonApiUrl = process.env.NEXT_PUBLIC_PYTHON_API_URL ?? "http://localhost:8000"
      const res = await fetch(`${pythonApiUrl}/api/v1/places/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: searchKeyword,
          latitude: lat,
          longitude: lng,
          radius,
          max_results: maxResults,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`)
      }

      const data: SearchResponse = await res.json()
      let enrichedResults: EnrichedResult[] = data.results ?? []
      if (onlyWithWebsite) {
        enrichedResults = enrichedResults.filter((r) => r.website)
      }
      resultsRef.current = enrichedResults
      setResults(enrichedResults)

      // Start auto enrichment if enabled
      if (enrichEmail && enrichedResults.length > 0) {
        void runEnrichment(enrichedResults)
      }
      // Start social enrichment if enabled (parallel กับ email enrichment)
      if (enrichSocial && enrichedResults.length > 0) {
        void runSocialEnrichment(enrichedResults)
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการค้นหา")
    } finally {
      setIsSearching(false)
    }
  }, [keyword, Array.from(selectedSubCategories).join(" "), selectedCategory, lat, lng, radius, maxResults, enrichEmail, enrichSocial, onlyWithWebsite, runEnrichment, runSocialEnrichment])

  // ============================================================
  // Selection
  // ============================================================

  const handleToggle = (placeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(placeId)) next.delete(placeId)
      else next.add(placeId)
      return next
    })
  }

  const handleSelectAll = () => {
    if (!results) return
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(results.map((r) => r.place_id)))
    }
  }

  // ============================================================
  // Export CSV
  // ============================================================

  const handleExportCSV = () => {
    if (!results || results.length === 0) return
    const headers = ["ชื่อ", "ที่อยู่", "โทร", "เว็บไซต์", "อีเมล", "Facebook", "LINE", "หมวดหมู่", "คะแนน"]
    const rows = results.map((r) => [
      r.name,
      r.address ?? "",
      r.phone ?? "",
      r.website ?? "",
      r.email ?? "",
      r.facebook?.url ?? r.facebook?.handle ?? "",
      r.line?.url ?? r.line?.handle ?? "",
      r.category ?? "",
      r.score?.toString() ?? "",
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `leads-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ============================================================
  // Save
  // ============================================================

  const handleSaveBulk = async () => {
    if (!results || selectedIds.size === 0) return
    setIsSaving(true)
    setErrorMsg(null)
    setSaveResult(null)

    const selected = resultsRef.current.filter((r) => selectedIds.has(r.place_id))
    const leadsPayload = selected.map((p) => ({
      name: p.name,
      address: p.address ?? undefined,
      phone: p.phone ?? undefined,
      website: p.website ?? undefined,
      email: p.email ?? undefined,
      placeId: p.place_id ?? undefined,
      latitude: p.latitude ?? undefined,
      longitude: p.longitude ?? undefined,
      rating: p.rating ?? undefined,
      reviewCount: p.review_count ?? undefined,
      category: p.category ?? undefined,
      sourceType: "places_api" as const,
    }))

    try {
      const result = await trpc.lead.createBulk.mutate({ workspaceId, leads: leadsPayload })
      setSaveResult(result)
      setSelectedIds(new Set())
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถบันทึก leads ได้"
      setErrorMsg(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const allSelected =
    results !== undefined && results.length > 0 && selectedIds.size === results.length

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--color-canvas)" }}>
      {/* ==================== LEFT PANEL — Search Form ==================== */}
      <aside
        className="flex h-screen w-full shrink-0 flex-col border-r bg-white md:w-[380px]"
        style={{ borderColor: "var(--color-border)" }}
      >
        {/* Panel header */}
        <div
          className="border-b px-5 py-4"
          style={{ borderColor: "var(--color-border)" }}
        >
          <h1 className="text-base font-bold" style={{ color: "var(--color-ink)" }}>
            ค้นหา Lead ใหม่
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
            ค้นหาธุรกิจจาก Google Maps
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* ---- Category pills ---- */}
          <div>
            <label className="mb-2 block text-[13px] font-medium" style={{ color: "var(--color-ink)" }}>
              หมวดหมู่
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const active = selectedCategory === cat
                return (
                  <button
                    key={cat}
                    onClick={() => handleCategorySelect(cat)}
                    className="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: active ? "var(--color-primary)" : "transparent",
                      color: active ? "white" : "var(--color-muted)",
                      border: `1.5px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
                      borderRadius: "9999px",
                    }}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ---- Sub-category pills ---- */}
          <div>
            <label className="mb-2 block text-[13px] font-medium" style={{ color: "var(--color-ink)" }}>
              ประเภทย่อย
            </label>
            <div className="flex flex-wrap gap-1.5">
              {/* ทั้งหมด button */}
              <button
                onClick={handleToggleAllSubCategories}
                className="rounded-full px-3 py-1 text-[11px] font-medium transition-all"
                style={{
                  backgroundColor: selectedSubCategories.size === SUB_CATEGORIES[selectedCategory].length ? "var(--color-primary)" : "transparent",
                  color: selectedSubCategories.size === SUB_CATEGORIES[selectedCategory].length ? "white" : "var(--color-muted)",
                  border: `1px solid ${selectedSubCategories.size === SUB_CATEGORIES[selectedCategory].length ? "var(--color-primary)" : "var(--color-border)"}`,
                  borderRadius: "9999px",
                }}
              >
                ทั้งหมด
              </button>
              {SUB_CATEGORIES[selectedCategory].map((sub) => {
                const active = selectedSubCategories.has(sub)
                return (
                  <button
                    key={sub}
                    onClick={() => handleSubCategoryToggle(sub)}
                    className="rounded-full px-3 py-1 text-[11px] font-medium transition-all"
                    style={{
                      backgroundColor: active ? "var(--color-primary-light)" : "transparent",
                      color: active ? "var(--color-primary)" : "var(--color-muted)",
                      border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
                      borderRadius: "9999px",
                    }}
                  >
                    {sub}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ---- Keyword ---- */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium" style={{ color: "var(--color-ink)" }}>
              คีย์เวิร์ด
            </label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: "var(--color-muted)" }}
              />
              <Input
                placeholder="เช่น ร้านอาหาร สีลม..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9 text-sm"
                style={{ borderRadius: "var(--radius-input)" }}
              />
            </div>
          </div>

          {/* ---- Location ---- */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium" style={{ color: "var(--color-ink)" }}>
              ตำแหน่ง
            </label>

            {/* Province Combobox */}
            <Popover open={provinceOpen} onOpenChange={setProvinceOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={provinceOpen}
                  className="h-10 w-full justify-between text-sm font-normal"
                  style={{
                    borderColor: "var(--color-border)",
                    borderRadius: "var(--radius-input)",
                  }}
                >
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0" style={{ color: "var(--color-primary)" }} />
                    {locationLabel}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
                style={{
                  backgroundColor: "white",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-card)",
                }}
              >
                <Command>
                  <CommandInput placeholder="ค้นหาจังหวัด..." />
                  <CommandList>
                    <CommandEmpty>ไม่พบจังหวัด</CommandEmpty>
                    <CommandGroup>
                      {Object.entries(PROVINCES).map(([key, prov]) => (
                        <CommandItem
                          key={key}
                          value={prov.label}
                          onSelect={() => {
                            setProvinceKey(key)
                            setSelectedDistricts(new Set())
                            setProvinceOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              provinceKey === key ? "opacity-100" : "opacity-0"
                            )}
                            style={{ color: "var(--color-primary)" }}
                          />
                          {prov.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* District chips */}
            {province.districts.length > 0 && (
              <div className="mt-2.5">
                <p className="mb-1.5 text-xs" style={{ color: "var(--color-muted)" }}>
                  ย่าน / อำเภอ{" "}
                  {selectedDistricts.size > 0 && (
                    <span style={{ color: "var(--color-primary)" }}>
                      ({selectedDistricts.size} เลือกแล้ว)
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {province.districts.map((d, idx) => {
                    const isActive = selectedDistricts.has(idx)
                    return (
                      <button
                        key={d.label}
                        onClick={() => toggleDistrict(idx)}
                        className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-150"
                        style={{
                          borderColor: isActive ? "var(--color-primary)" : "var(--color-border)",
                          color: isActive ? "var(--color-primary)" : "var(--color-muted)",
                          backgroundColor: isActive ? "var(--color-primary-light)" : "transparent",
                        }}
                      >
                        <MapPin className="h-2.5 w-2.5" />
                        {d.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ---- Radius ---- */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[13px] font-medium" style={{ color: "var(--color-ink)" }}>
                รัศมีค้นหา
              </label>
              <span className="text-[13px] font-semibold" style={{ color: "var(--color-primary)" }}>
                {radius >= 1000 ? `${radius / 1000} กม.` : `${radius} ม.`}
              </span>
            </div>
            <div className="flex gap-1.5">
              {RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRadius(opt.value)}
                  className="flex-1 rounded-lg py-1.5 text-[11px] font-medium transition-all"
                  style={{
                    backgroundColor: radius === opt.value ? "var(--color-primary)" : "var(--color-canvas)",
                    color: radius === opt.value ? "white" : "var(--color-muted)",
                    border: `1px solid ${radius === opt.value ? "var(--color-primary)" : "var(--color-border)"}`,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ---- AI Enrichment ---- */}
          <div
            className="rounded-xl border p-3.5"
            style={{
              borderColor: "var(--color-border)",
              borderRadius: "var(--radius-card)",
            }}
          >
            <div className="mb-2.5 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" style={{ color: "var(--color-ai)" }} />
              <span className="text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>
                AI Enrichment
              </span>
            </div>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2.5">
                <Checkbox
                  checked={enrichEmail}
                  onCheckedChange={(v) => setEnrichEmail(Boolean(v))}
                />
                <span className="text-xs" style={{ color: "var(--color-ink)" }}>
                  ค้นหาอีเมล
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5">
                <Checkbox
                  checked={enrichScore}
                  onCheckedChange={(v) => setEnrichScore(Boolean(v))}
                />
                <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                  AI Lead Score
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5">
                <Checkbox
                  checked={enrichSocial}
                  onCheckedChange={(v) => setEnrichSocial(Boolean(v))}
                />
                <span className="text-xs" style={{ color: "var(--color-ink)" }}>
                  ค้นหาโซเชียลมีเดีย (FB + LINE)
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5">
                <Checkbox
                  checked={onlyWithWebsite}
                  onCheckedChange={(v) => setOnlyWithWebsite(Boolean(v))}
                />
                <span className="text-xs" style={{ color: "var(--color-ink)" }}>
                  เฉพาะลีดที่มีเว็บไซต์
                </span>
              </label>
            </div>
          </div>

          {/* ---- Max Results ---- */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium" style={{ color: "var(--color-ink)" }}>
              จำนวนสูงสุด
            </label>
            <select
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              className="h-10 w-full rounded-lg border bg-white px-3 text-sm"
              style={{
                borderColor: "var(--color-border)",
                borderRadius: "var(--radius-input)",
                color: "var(--color-ink)",
                outline: "none",
              }}
            >
              {MAX_RESULTS_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} รายการ
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search button pinned at bottom */}
        <div
          className="border-t p-5"
          style={{ borderColor: "var(--color-border)" }}
        >
          <Button
            onClick={handleSearch}
            disabled={isSearching}
            className="w-full text-white"
            style={{
              backgroundColor: "var(--color-primary)",
              borderRadius: "var(--radius-btn)",
            }}
          >
            {isSearching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                กำลังค้นหา...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                ค้นหาลีด
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* ==================== RIGHT PANEL — Results ==================== */}
      <main className="flex min-w-0 flex-1 flex-col h-screen overflow-hidden">
        {/* Results header */}
        <div
          className="sticky top-0 z-10 flex items-center gap-3 border-b bg-white px-6 py-3.5"
          style={{ borderColor: "var(--color-border)" }}
        >
          {/* Count */}
          <span className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
            {results !== undefined ? `พบ ${results.length} รายการ` : "ผลการค้นหา"}
          </span>

          {/* Enrichment badge */}
          {enrichingCount > 0 && (
            <span
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{
                backgroundColor: "#F0FDF4",
                color: "var(--color-success)",
                borderRadius: "9999px",
              }}
            >
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              AI กำลัง Enrich {enrichingCount} รายการ
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* Export CSV */}
            {results && results.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="h-8 gap-1.5 text-xs"
                style={{
                  borderColor: "var(--color-border)",
                  borderRadius: "var(--radius-btn)",
                  color: "var(--color-ink)",
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            )}

            {/* View toggle */}
            <div
              className="flex rounded-lg border"
              style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-input)" }}
            >
              <button
                onClick={() => setViewMode("list")}
                className="flex h-8 w-8 items-center justify-center rounded-l-lg transition-colors"
                style={{
                  backgroundColor: viewMode === "list" ? "var(--color-primary-light)" : "transparent",
                  color: viewMode === "list" ? "var(--color-primary)" : "var(--color-muted)",
                }}
              >
                <LayoutList className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className="flex h-8 w-8 items-center justify-center rounded-r-lg transition-colors"
                style={{
                  backgroundColor: viewMode === "grid" ? "var(--color-primary-light)" : "transparent",
                  color: viewMode === "grid" ? "var(--color-primary)" : "var(--color-muted)",
                }}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Error */}
          {errorMsg && (
            <div
              className="mb-4 flex items-center gap-2 rounded-lg p-4 text-sm"
              style={{
                backgroundColor: "#FFF5F5",
                border: "1px solid #FECACA",
                color: "var(--color-danger)",
                borderRadius: "var(--radius-card)",
              }}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* Save Result */}
          {saveResult && (
            <div
              className="mb-4 rounded-lg p-4 text-sm"
              style={{
                backgroundColor: "#F0FDF4",
                border: "1px solid #BBF7D0",
                color: "var(--color-success)",
                borderRadius: "var(--radius-card)",
              }}
            >
              บันทึกสำเร็จ {saveResult.created} leads
              {saveResult.skipped > 0 && ` (ข้าม ${saveResult.skipped} รายการที่มีอยู่แล้ว)`}
            </div>
          )}

          {/* Loading Skeleton */}
          {isSearching && (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border bg-white p-4"
                  style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 rounded bg-gray-200 animate-pulse" />
                    <div className="h-9 w-9 rounded-full bg-gray-200 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/3 rounded bg-gray-200 animate-pulse" />
                      <div className="h-3 w-2/3 rounded bg-gray-200 animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Results List */}
          {results !== undefined && !isSearching && (
            <>
              {/* Select all row */}
              {results.length > 0 && (
                <div className="mb-3 flex items-center gap-3">
                  <div
                    onClick={handleSelectAll}
                    className="flex cursor-pointer items-center gap-2 text-xs font-medium transition-colors"
                    style={{ color: "var(--color-primary)" }}
                  >
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                    />
                    <span>{allSelected ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}</span>
                  </div>
                </div>
              )}

              {/* Empty */}
              {results.length === 0 ? (
                <div
                  className="rounded-xl border bg-white p-16 text-center"
                  style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
                >
                  <Building2
                    className="mx-auto mb-3 h-10 w-10"
                    style={{ color: "var(--color-border)" }}
                  />
                  <p className="font-medium" style={{ color: "var(--color-ink)" }}>
                    ไม่พบผลลัพธ์
                  </p>
                  <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
                    ลองเปลี่ยนคำค้นหาหรือขยายรัศมี
                  </p>
                </div>
              ) : viewMode === "list" ? (
                <div className="space-y-2 pb-24">
                  {results.map((result, index) => (
                    <LeadListRow
                      key={result.place_id}
                      result={result}
                      index={index}
                      selected={selectedIds.has(result.place_id)}
                      onToggle={() => handleToggle(result.place_id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 pb-24 sm:grid-cols-2 xl:grid-cols-3">
                  {results.map((result, index) => (
                    <LeadGridCard
                      key={result.place_id}
                      result={result}
                      index={index}
                      selected={selectedIds.has(result.place_id)}
                      onToggle={() => handleToggle(result.place_id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Initial empty state */}
          {results === undefined && !isSearching && (
            <div className="flex flex-col items-center justify-center py-24">
              <div
                className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--color-primary-light)" }}
              >
                <Search className="h-8 w-8" style={{ color: "var(--color-primary)" }} />
              </div>
              <p className="text-base font-medium" style={{ color: "var(--color-ink)" }}>
                เริ่มค้นหาลีดของคุณ
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
                เลือกหมวดหมู่ ตำแหน่ง แล้วกด "ค้นหาลีด"
              </p>
            </div>
          )}
        </div>

        {/* ==================== STICKY BOTTOM BAR ==================== */}
        {selectedIds.size > 0 && (
          <div
            className="fixed bottom-0 right-0 z-50 flex items-center justify-between border-t bg-white px-6 py-3.5 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]"
            style={{ borderColor: "var(--color-border)", left: "var(--sidebar-width, 210px)" }}
          >
            <span className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
              เลือก {selectedIds.size} รายการ
            </span>
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-sm"
                style={{
                  borderColor: "var(--color-border)",
                  color: "var(--color-ink)",
                  borderRadius: "var(--radius-btn)",
                }}
                onClick={() => {/* TODO: Assign workspace */}}
              >
                Assign Workspace
              </Button>
              <Button
                onClick={handleSaveBulk}
                disabled={isSaving}
                size="sm"
                className="h-9 text-sm text-white"
                style={{
                  backgroundColor: "var(--color-primary)",
                  borderRadius: "var(--radius-btn)",
                }}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    บันทึกทั้งหมด
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
