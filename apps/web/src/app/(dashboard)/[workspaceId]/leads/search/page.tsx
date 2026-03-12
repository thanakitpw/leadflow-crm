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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { trpc } from "@/lib/trpc/client"

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

const CITY_PRESETS = [
  { label: "กรุงเทพฯ (สีลม)", lat: 13.7248, lng: 100.5286 },
  { label: "กรุงเทพฯ (สยาม)", lat: 13.7457, lng: 100.5334 },
  { label: "เชียงใหม่", lat: 18.7883, lng: 98.9853 },
  { label: "ภูเก็ต", lat: 7.8804, lng: 98.3923 },
  { label: "ขอนแก่น", lat: 16.4322, lng: 102.8236 },
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

function StarRating({ rating }: { rating: number }) {
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
  const [lat, setLat] = useState<string>("13.7248")
  const [lng, setLng] = useState<string>("100.5286")
  const [radius, setRadius] = useState(2000)

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
    const parsedLat = parseFloat(lat)
    const parsedLng = parseFloat(lng)
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      setErrorMsg("พิกัดไม่ถูกต้อง กรุณาระบุ Latitude และ Longitude ให้ถูกต้อง")
      return
    }

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
          latitude: parsedLat,
          longitude: parsedLng,
          radius,
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
      address: p.address,
      phone: p.phone,
      website: p.website,
      placeId: p.place_id,
      latitude: p.latitude,
      longitude: p.longitude,
      rating: p.rating,
      reviewCount: p.review_count,
      category: p.category,
      sourceType: "places_api" as const,
    }))

    try {
      const result = await trpc.lead.createBulk.mutate({
        workspaceId,
        leads: leadsPayload,
      })
      setSaveResult(result)
      setSelectedIds(new Set())
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "ไม่สามารถบันทึก leads ได้"
      )
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
              พิกัดตำแหน่ง
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="mb-1 block text-xs"
                  style={{ color: "var(--color-muted)" }}
                >
                  Latitude (ละติจูด)
                </label>
                <Input
                  placeholder="13.7248"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  style={{ borderRadius: "var(--radius-input)" }}
                />
              </div>
              <div>
                <label
                  className="mb-1 block text-xs"
                  style={{ color: "var(--color-muted)" }}
                >
                  Longitude (ลองจิจูด)
                </label>
                <Input
                  placeholder="100.5286"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  style={{ borderRadius: "var(--radius-input)" }}
                />
              </div>
            </div>
            {/* City Presets */}
            <div className="mt-2 flex flex-wrap gap-2">
              {CITY_PRESETS.map((city) => (
                <button
                  key={city.label}
                  onClick={() => {
                    setLat(city.lat.toString())
                    setLng(city.lng.toString())
                  }}
                  className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors hover:border-primary"
                  style={{
                    borderColor: "var(--color-border)",
                    color: "var(--color-muted)",
                    borderRadius: "9999px",
                  }}
                >
                  <MapPin className="h-3 w-3" />
                  {city.label}
                </button>
              ))}
            </div>
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

          {/* Submit */}
          <Button
            onClick={handleSearch}
            disabled={isSearching || !keyword.trim()}
            className="w-full"
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
                  style={{
                    backgroundColor: "var(--color-success)",
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
