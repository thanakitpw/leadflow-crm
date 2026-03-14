"use client"

import { useState, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  MapPin,
  Search,
  Star,
  Phone,
  Globe,
  Building2,
  Loader2,
  Save,
  ChevronRight,
  Database,
  CheckSquare2,
  Square,
  AlertCircle,
  Check,
  ChevronsUpDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import type { District, ProvinceData } from "@/lib/thai-provinces"

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

interface SearchResponse {
  results: PlaceResult[]
  cached: boolean
  total: number
}

// ============================================================
// Constants
// ============================================================

const CATEGORY_PRESETS = [
  { label: "F&B", keyword: "ร้านอาหาร" },
  { label: "SME", keyword: "ร้านค้า SME" },
  { label: "อสังหาฯ", keyword: "อสังหาริมทรัพย์" },
  { label: "B2B", keyword: "บริษัท B2B" },
]

const RADIUS_OPTIONS = [
  { label: "500 ม.", value: 500 },
  { label: "1 กม.", value: 1000 },
  { label: "2 กม.", value: 2000 },
  { label: "5 กม.", value: 5000 },
  { label: "10 กม.", value: 10000 },
]

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
          className="h-3.5 w-3.5"
          style={{
            fill: star <= Math.round(rating) ? "#D97706" : "transparent",
            color: star <= Math.round(rating) ? "#D97706" : "#E5DDD6",
          }}
        />
      ))}
      <span
        className="ml-1 text-xs font-medium"
        style={{ color: "var(--color-muted)" }}
      >
        {rating.toFixed(1)}
      </span>
    </span>
  )
}

function PlaceCard({
  place,
  selected,
  onToggle,
}: {
  place: PlaceResult
  selected: boolean
  onToggle: () => void
}) {
  return (
    <div
      className="rounded-xl border bg-white p-4 transition-all"
      style={{
        borderColor: selected ? "var(--color-primary)" : "var(--color-border)",
        borderWidth: selected ? "1.5px" : "1px",
        backgroundColor: selected ? "var(--color-primary-light)" : "white",
        borderRadius: "var(--radius-card)",
      }}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div className="mt-0.5 shrink-0">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            id={`place-${place.place_id}`}
          />
        </div>

        {/* Content */}
        <label
          htmlFor={`place-${place.place_id}`}
          className="min-w-0 flex-1 cursor-pointer"
        >
          {/* Header */}
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span
              className="font-semibold"
              style={{ color: "var(--color-ink)" }}
            >
              {place.name}
            </span>
            {place.cached !== undefined && (
              <Badge
                variant="outline"
                className="shrink-0 gap-1 text-[11px]"
                style={
                  place.cached
                    ? {
                        borderColor: "#D97706",
                        color: "#D97706",
                        backgroundColor: "#FEF3C7",
                      }
                    : {
                        borderColor: "var(--color-success)",
                        color: "var(--color-success)",
                        backgroundColor: "#F0FDF4",
                      }
                }
              >
                {place.cached && <Database className="h-2.5 w-2.5" />}
                {place.cached ? "from cache" : "Fresh"}
              </Badge>
            )}
            {place.category && (
              <Badge
                variant="outline"
                className="shrink-0 text-[11px]"
                style={{
                  borderColor: "var(--color-border)",
                  color: "var(--color-muted)",
                }}
              >
                {place.category}
              </Badge>
            )}
          </div>

          {/* Rating */}
          {place.rating !== undefined && (
            <div className="mb-2 flex items-center gap-2">
              <StarRating rating={place.rating} />
              {place.review_count !== undefined && (
                <span
                  className="text-xs"
                  style={{ color: "var(--color-muted)" }}
                >
                  ({place.review_count.toLocaleString()} รีวิว)
                </span>
              )}
            </div>
          )}

          {/* Info */}
          <div className="space-y-1">
            {place.address && (
              <div className="flex items-start gap-1.5">
                <MapPin
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  style={{ color: "var(--color-muted)" }}
                />
                <span
                  className="text-xs leading-5"
                  style={{ color: "var(--color-muted)" }}
                >
                  {place.address}
                </span>
              </div>
            )}
            {place.phone && (
              <div className="flex items-center gap-1.5">
                <Phone
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: "var(--color-muted)" }}
                />
                <span
                  className="text-xs"
                  style={{ color: "var(--color-muted)" }}
                >
                  {place.phone}
                </span>
              </div>
            )}
            {place.website && (
              <div className="flex items-center gap-1.5">
                <Globe
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: "var(--color-muted)" }}
                />
                <a
                  href={
                    place.website.startsWith("http")
                      ? place.website
                      : `https://${place.website}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-xs hover:underline"
                  style={{ color: "var(--color-info)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {place.website.replace(/^https?:\/\//, "").split("/")[0]}
                </a>
              </div>
            )}
          </div>
        </label>
      </div>
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
  const [keyword, setKeyword] = useState("")
  const [provinceKey, setProvinceKey] = useState<string>("bangkok")
  const [selectedDistricts, setSelectedDistricts] = useState<Set<number>>(new Set())
  const [provinceOpen, setProvinceOpen] = useState(false)
  const [radius, setRadius] = useState(2000)
  const [maxResults, setMaxResults] = useState(20)

  const province = PROVINCES[provinceKey]
  // ถ้าเลือกหลายย่าน ใช้ตัวแรกที่เลือก, ถ้าไม่เลือกเลยใช้กลางจังหวัด
  const firstSelected = selectedDistricts.size > 0 ? Array.from(selectedDistricts)[0] : null
  const selectedDistrict = firstSelected !== null ? province.districts[firstSelected] : null
  const lat = selectedDistrict?.lat ?? province.lat
  const lng = selectedDistrict?.lng ?? province.lng

  const toggleDistrict = (idx: number) => {
    setSelectedDistricts((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  // Results + selection state
  const [results, setResults] = useState<PlaceResult[] | undefined>(undefined)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSearching, setIsSearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [responseInfo, setResponseInfo] = useState<{
    cached: boolean
    total: number
  } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [saveResult, setSaveResult] = useState<{
    created: number
    skipped: number
  } | null>(null)

  // ค้นหา
  const handleSearch = useCallback(async () => {
    if (!keyword.trim()) return

    setIsSearching(true)
    setResults(undefined)
    setSelectedIds(new Set())
    setResponseInfo(null)
    setErrorMsg(null)
    setSaveResult(null)

    try {
      const pythonApiUrl =
        process.env.NEXT_PUBLIC_PYTHON_API_URL ?? "http://localhost:8000"
      const res = await fetch(`${pythonApiUrl}/api/v1/places/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: keyword.trim(),
          latitude: lat,
          longitude: lng,
          radius,
          max_results: maxResults,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          (err as { detail?: string }).detail ?? `HTTP ${res.status}`
        )
      }

      const data: SearchResponse = await res.json()
      setResults(data.results ?? [])
      setResponseInfo({ cached: data.cached, total: data.total })
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการค้นหา"
      )
    } finally {
      setIsSearching(false)
    }
  }, [keyword, lat, lng, radius])

  // Toggle เลือก / ยกเลิก lead
  const handleToggle = (placeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(placeId)) next.delete(placeId)
      else next.add(placeId)
      return next
    })
  }

  // Select all / deselect all
  const handleSelectAll = () => {
    if (!results) return
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(results.map((r) => r.place_id)))
    }
  }

  // บันทึก leads ที่เลือก
  const handleSaveBulk = async () => {
    if (!results || selectedIds.size === 0) return
    setIsSaving(true)
    setErrorMsg(null)
    setSaveResult(null)

    const selected = results.filter((r) => selectedIds.has(r.place_id))
    const leadsPayload = selected.map((p) => ({
      name: p.name,
      address: p.address ?? undefined,
      phone: p.phone ?? undefined,
      website: p.website ?? undefined,
      placeId: p.place_id ?? undefined,
      latitude: p.latitude ?? undefined,
      longitude: p.longitude ?? undefined,
      rating: p.rating ?? undefined,
      reviewCount: p.review_count ?? undefined,
      category: p.category ?? undefined,
      sourceType: "places_api" as const,
    }))

    try {
      const result = await trpc.lead.createBulk.mutate({
        workspaceId,
        leads: leadsPayload,
      })
      setSaveResult(result)
      setSelectedIds(new Set())
    } catch (err: unknown) {
      console.error("Save leads error:", err)
      const msg = err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : "ไม่สามารถบันทึก leads ได้"
      setErrorMsg(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const allSelected =
    results !== undefined &&
    results.length > 0 &&
    selectedIds.size === results.length

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-canvas)" }}>
      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div
            className="mb-1 flex items-center gap-2 text-sm"
            style={{ color: "var(--color-muted)" }}
          >
            <span>Leads</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>ค้นหา Lead ใหม่</span>
          </div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--color-ink)" }}
          >
            ค้นหา Lead จาก Places
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
            ค้นหาธุรกิจจาก Google Places API แล้วเลือกบันทึกเป็น lead
          </p>
        </div>

        {/* Search Form */}
        <div
          className="mb-6 rounded-xl border bg-white p-6 shadow-sm"
          style={{
            borderColor: "var(--color-border)",
            borderRadius: "var(--radius-card)",
          }}
        >
          {/* Keyword */}
          <div className="mb-4">
            <label
              className="mb-1.5 block text-sm font-medium"
              style={{ color: "var(--color-ink)" }}
            >
              คำค้นหา
            </label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: "var(--color-muted)" }}
              />
              <Input
                placeholder="เช่น ร้านอาหาร สีลม, บริษัทรับเหมา..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
                style={{ borderRadius: "var(--radius-input)" }}
              />
            </div>
            {/* Category Presets */}
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORY_PRESETS.map((cat) => (
                <button
                  key={cat.label}
                  onClick={() => setKeyword(cat.keyword)}
                  className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                  style={{
                    borderColor:
                      keyword === cat.keyword
                        ? "var(--color-primary)"
                        : "var(--color-border)",
                    color:
                      keyword === cat.keyword
                        ? "var(--color-primary)"
                        : "var(--color-muted)",
                    backgroundColor:
                      keyword === cat.keyword
                        ? "var(--color-primary-light)"
                        : "transparent",
                    borderRadius: "9999px",
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="mb-4">
            <label
              className="mb-1.5 block text-sm font-medium"
              style={{ color: "var(--color-ink)" }}
            >
              พื้นที่ค้นหา
            </label>
            <Popover open={provinceOpen} onOpenChange={setProvinceOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={provinceOpen}
                  className="h-10 w-full justify-between text-sm font-normal"
                  style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-input)" }}
                >
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0" style={{ color: "var(--color-primary)" }} />
                    {province.label}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
                style={{ backgroundColor: "white", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)" }}
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

            {/* Districts */}
            {province.districts.length > 0 && (
              <div className="mt-2.5">
                <p className="mb-1.5 text-xs" style={{ color: "var(--color-muted)" }}>
                  ย่าน / อำเภอ {selectedDistricts.size > 0 && (
                    <span style={{ color: "var(--color-primary)" }}>
                      ({selectedDistricts.size} เลือกแล้ว)
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {province.districts.map((d, idx) => {
                    const isActive = selectedDistricts.has(idx)
                    return (
                      <button
                        key={d.label}
                        onClick={() => toggleDistrict(idx)}
                        className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150"
                        style={{
                          borderColor: isActive ? "var(--color-primary)" : "var(--color-border)",
                          color: isActive ? "var(--color-primary)" : "var(--color-muted)",
                          backgroundColor: isActive ? "var(--color-primary-light)" : "transparent",
                        }}
                      >
                        <MapPin className="h-3 w-3" />
                        {d.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Radius */}
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <label
                className="text-sm font-medium"
                style={{ color: "var(--color-ink)" }}
              >
                รัศมีการค้นหา
              </label>
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--color-primary)" }}
              >
                {radius >= 1000 ? `${radius / 1000} กม.` : `${radius} ม.`}
              </span>
            </div>
            <Slider
              min={500}
              max={10000}
              step={500}
              value={[radius]}
              onValueChange={(vals) => setRadius(vals[0])}
              className="mb-2"
            />
            <div className="flex justify-between">
              {RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRadius(opt.value)}
                  className="text-[11px] transition-colors"
                  style={{
                    color:
                      radius === opt.value
                        ? "var(--color-primary)"
                        : "var(--color-muted)",
                    fontWeight: radius === opt.value ? 600 : 400,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Max Results */}
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <label
                className="text-sm font-medium"
                style={{ color: "var(--color-ink)" }}
              >
                จำนวน Lead ที่ต้องการ
              </label>
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--color-primary)" }}
              >
                {maxResults} รายการ
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[10, 20, 40, 60].map((n) => (
                <button
                  key={n}
                  onClick={() => setMaxResults(n)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-150"
                  style={{
                    borderColor: maxResults === n ? "var(--color-primary)" : "var(--color-border)",
                    color: maxResults === n ? "var(--color-primary)" : "var(--color-muted)",
                    backgroundColor: maxResults === n ? "var(--color-primary-light)" : "transparent",
                  }}
                >
                  {n}
                </button>
              ))}
              <Input
                type="number"
                min={1}
                max={60}
                value={maxResults}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  if (!isNaN(v) && v >= 1 && v <= 60) setMaxResults(v)
                }}
                className="h-9 w-20 text-center text-sm"
                style={{ borderRadius: "var(--radius-input)" }}
              />
            </div>
            <p className="mt-1.5 text-xs" style={{ color: "var(--color-muted)" }}>
              Places API ให้ผลลัพธ์สูงสุด 60 รายการต่อครั้ง
            </p>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSearch}
            disabled={isSearching || !keyword.trim()}
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
                ค้นหา Lead
              </>
            )}
          </Button>
        </div>

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
            {saveResult.skipped > 0 &&
              ` (ข้าม ${saveResult.skipped} รายการที่มีอยู่แล้ว)`}
          </div>
        )}

        {/* Loading Skeleton */}
        {isSearching && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border bg-white p-4"
                style={{
                  borderColor: "var(--color-border)",
                  borderRadius: "var(--radius-card)",
                }}
              >
                <div className="animate-pulse space-y-3">
                  <div className="h-4 w-1/3 rounded bg-gray-200" />
                  <div className="h-3 w-1/4 rounded bg-gray-200" />
                  <div className="h-3 w-2/3 rounded bg-gray-200" />
                  <div className="h-3 w-1/2 rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {results !== undefined && !isSearching && (
          <div>
            {/* Results Header + Select All + Save */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {results.length > 0 && (
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center gap-2 text-sm font-medium transition-colors"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {allSelected ? (
                      <CheckSquare2 className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    {allSelected ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
                  </button>
                )}
                <span
                  className="text-sm"
                  style={{ color: "var(--color-muted)" }}
                >
                  พบ {results.length} ผลลัพธ์
                  {responseInfo && (
                    <span className="ml-1">
                      {responseInfo.cached ? "(จาก Cache)" : "(ข้อมูลใหม่)"}
                    </span>
                  )}
                </span>
              </div>

              {selectedIds.size > 0 && (
                <Button
                  onClick={handleSaveBulk}
                  disabled={isSaving}
                  className="text-white"
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
                      บันทึก {selectedIds.size} leads
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Empty */}
            {results.length === 0 ? (
              <div
                className="rounded-xl border bg-white p-12 text-center"
                style={{
                  borderColor: "var(--color-border)",
                  borderRadius: "var(--radius-card)",
                }}
              >
                <Building2
                  className="mx-auto mb-3 h-10 w-10"
                  style={{ color: "var(--color-border)" }}
                />
                <p
                  className="font-medium"
                  style={{ color: "var(--color-ink)" }}
                >
                  ไม่พบผลลัพธ์
                </p>
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--color-muted)" }}
                >
                  ลองเปลี่ยนคำค้นหาหรือขยายรัศมี
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {results.map((place) => (
                    <PlaceCard
                      key={place.place_id}
                      place={place}
                      selected={selectedIds.has(place.place_id)}
                      onToggle={() => handleToggle(place.place_id)}
                    />
                  ))}
                </div>

                {/* Bottom sticky bar */}
                {selectedIds.size > 0 && (
                  <div
                    className="mt-6 flex items-center justify-between rounded-xl p-4"
                    style={{
                      backgroundColor: "var(--color-primary)",
                      borderRadius: "var(--radius-card)",
                    }}
                  >
                    <span className="text-sm font-medium text-white">
                      เลือกแล้ว {selectedIds.size} รายการ
                    </span>
                    <Button
                      onClick={handleSaveBulk}
                      disabled={isSaving}
                      variant="secondary"
                      style={{
                        borderRadius: "var(--radius-btn)",
                        backgroundColor: "white",
                        color: "var(--color-primary)",
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
                          บันทึก {selectedIds.size} leads
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Initial empty state */}
        {results === undefined && !isSearching && (
          <div className="flex flex-col items-center justify-center py-20">
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--color-primary-light)" }}
            >
              <Building2
                className="h-8 w-8"
                style={{ color: "var(--color-primary)" }}
              />
            </div>
            <p
              className="text-base font-medium"
              style={{ color: "var(--color-ink)" }}
            >
              ยังไม่มีผลลัพธ์
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
              กรอกคำค้นหาและกด "ค้นหา Lead" เพื่อดูธุรกิจจาก Google Places
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
