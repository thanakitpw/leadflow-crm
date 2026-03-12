"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import {
  BarChart3,
  Users,
  Send,
  TrendingUp,
  MousePointerClick,
  AlertTriangle,
  Clock,
  Calendar,
} from "lucide-react"
import { trpc } from "@/lib/trpc/client"

// ============================================================
// Types
// ============================================================

interface ReportMeta {
  id: string
  title: string
  date_from: string
  date_to: string
  share_expires_at: string | null
  workspace_id: string
}

interface CampaignStats {
  id: string
  name: string
  status: string
  stats: {
    sent: number
    opened: number
    clicked: number
    bounced: number
    openRate: number
    clickRate: number
  }
}

interface ReportData {
  leads: { total: number; withEmail: number }
  emails: {
    sent: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    openRate: number
    clickRate: number
  }
  allCampaigns: CampaignStats[]
}

// ============================================================
// Helpers
// ============================================================

function formatDateTH(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`
}

// ============================================================
// Sub-components
// ============================================================

function StatBox({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  color: string
  bg: string
}) {
  return (
    <div
      className="rounded-xl border bg-white p-5"
      style={{ borderColor: "#E5DDD6", borderRadius: "12px" }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium" style={{ color: "#7A6F68" }}>
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold" style={{ color: "#1C1814" }}>
            {value}
          </p>
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: bg }}
        >
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
    </div>
  )
}

function SkeletonStat() {
  return (
    <div
      className="rounded-xl border bg-white p-5 animate-pulse"
      style={{ borderColor: "#E5DDD6", borderRadius: "12px" }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="h-3 w-20 rounded bg-gray-200 mb-2" />
          <div className="h-8 w-14 rounded bg-gray-200" />
        </div>
        <div className="h-9 w-9 rounded-lg bg-gray-100" />
      </div>
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function PublicReportPage() {
  const params = useParams()
  const token = params.token as string

  const [meta, setMeta] = useState<ReportMeta | null>(null)
  const [metaLoading, setMetaLoading] = useState(true)
  const [metaError, setMetaError] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [dataLoading, setDataLoading] = useState(false)

  // Fetch report meta first
  useEffect(() => {
    let cancelled = false
    setMetaLoading(true)
    trpc.report.getByToken.query({ token })
      .then((result) => {
        if (cancelled) return
        const r = result as ReportMeta
        // ตรวจสอบหมดอายุ
        if (r.share_expires_at && new Date(r.share_expires_at) < new Date()) {
          setIsExpired(true)
        } else {
          setMeta(r)
        }
      })
      .catch(() => {
        if (!cancelled) setMetaError(true)
      })
      .finally(() => {
        if (!cancelled) setMetaLoading(false)
      })
    return () => { cancelled = true }
  }, [token])

  // Fetch report data after meta is ready
  useEffect(() => {
    if (!meta || isExpired) return
    let cancelled = false
    setDataLoading(true)
    trpc.report.getData.query({ workspaceId: meta.workspace_id, reportId: meta.id })
      .then((result) => {
        if (!cancelled) setReportData(result as ReportData)
      })
      .catch(() => {
        // silently fail — show empty state
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false)
      })
    return () => { cancelled = true }
  }, [meta, isExpired])

  const isLoading = metaLoading || dataLoading

  // ============================================================
  // Render states
  // ============================================================

  if (metaLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#F7F5F2" }}>
        <div className="mx-auto max-w-4xl px-6 py-12">
          <div className="mb-8 animate-pulse">
            <div className="h-6 w-24 rounded bg-gray-200 mb-4" />
            <div className="h-8 w-64 rounded bg-gray-300 mb-2" />
            <div className="h-4 w-48 rounded bg-gray-200" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 mb-8">
            {[1, 2, 3, 4, 5].map((i) => <SkeletonStat key={i} />)}
          </div>
        </div>
      </div>
    )
  }

  if (metaError) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F7F5F2" }}>
        <div className="text-center max-w-sm px-6">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: "#FEF2F2" }}
          >
            <AlertTriangle className="h-8 w-8" style={{ color: "#DC2626" }} />
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: "#1C1814" }}>
            ไม่พบรายงาน
          </h1>
          <p className="text-sm" style={{ color: "#7A6F68" }}>
            ลิงก์รายงานนี้ไม่ถูกต้อง หรืออาจถูกลบไปแล้ว
          </p>
        </div>
      </div>
    )
  }

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F7F5F2" }}>
        <div className="text-center max-w-sm px-6">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: "#FEF3C7" }}
          >
            <Clock className="h-8 w-8" style={{ color: "#D97706" }} />
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: "#1C1814" }}>
            รายงานหมดอายุ
          </h1>
          <p className="text-sm" style={{ color: "#7A6F68" }}>
            รายงานนี้หมดอายุแล้ว กรุณาติดต่อผู้ส่งรายงาน
          </p>
        </div>
      </div>
    )
  }

  if (!meta) return null

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F7F5F2" }}>
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Branding Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-lg font-extrabold tracking-tight" style={{ color: "#1E3A5F" }}>
              LeadFlow
            </span>
            <span
              className="rounded px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: "#EEF2F8", color: "#1E3A5F", borderRadius: "6px" }}
            >
              รายงาน
            </span>
          </div>

          <h1 className="text-2xl font-bold mb-2" style={{ color: "#1C1814" }}>
            {meta.title}
          </h1>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" style={{ color: "#7A6F68" }} />
            <p className="text-sm" style={{ color: "#7A6F68" }}>
              ช่วงเวลา: {formatDateTH(meta.date_from)} — {formatDateTH(meta.date_to)}
            </p>
          </div>
        </div>

        {/* Stats */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 mb-8">
            {[1, 2, 3, 4, 5].map((i) => <SkeletonStat key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 mb-8">
            <StatBox
              label="Leads"
              value={reportData?.leads?.total ?? 0}
              icon={Users}
              color="#1E3A5F"
              bg="#EEF2F8"
            />
            <StatBox
              label="อีเมลส่งแล้ว"
              value={reportData?.emails?.sent ?? 0}
              icon={Send}
              color="#2563EB"
              bg="#DBEAFE"
            />
            <StatBox
              label="Open Rate"
              value={reportData?.emails?.openRate != null ? pct(reportData.emails.openRate) : "—"}
              icon={TrendingUp}
              color="#16A34A"
              bg="#F0FDF4"
            />
            <StatBox
              label="Click Rate"
              value={reportData?.emails?.clickRate != null ? pct(reportData.emails.clickRate) : "—"}
              icon={MousePointerClick}
              color="#7C3AED"
              bg="#EDE9FE"
            />
            <StatBox
              label="Bounced"
              value={reportData?.emails?.bounced ?? 0}
              icon={AlertTriangle}
              color="#D97706"
              bg="#FEF3C7"
            />
          </div>
        )}

        {/* Campaign Performance Table */}
        <div
          className="rounded-xl border bg-white overflow-hidden"
          style={{ borderColor: "#E5DDD6", borderRadius: "12px" }}
        >
          <div
            className="flex items-center gap-2 border-b px-5 py-4"
            style={{ borderColor: "#E5DDD6" }}
          >
            <BarChart3 className="h-4 w-4" style={{ color: "#1E3A5F" }} />
            <h2 className="text-sm font-semibold" style={{ color: "#1C1814" }}>
              Campaign Performance
            </h2>
          </div>

          {isLoading ? (
            <div className="p-5 space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-4 flex-1 rounded bg-gray-200" />
                  <div className="h-4 w-12 rounded bg-gray-100" />
                  <div className="h-4 w-12 rounded bg-gray-100" />
                  <div className="h-4 w-12 rounded bg-gray-100" />
                  <div className="h-4 w-12 rounded bg-gray-100" />
                </div>
              ))}
            </div>
          ) : !reportData?.allCampaigns || reportData.allCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <BarChart3 className="h-8 w-8" style={{ color: "#E5DDD6" }} />
              <p className="text-sm" style={{ color: "#7A6F68" }}>
                ไม่มีข้อมูล campaign ในช่วงเวลานี้
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid #E5DDD6" }}>
                    <th
                      className="px-5 py-3 text-left text-xs font-semibold"
                      style={{ color: "#1C1814" }}
                    >
                      Campaign
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-semibold"
                      style={{ color: "#1C1814" }}
                    >
                      Sent
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-semibold"
                      style={{ color: "#1C1814" }}
                    >
                      Opened
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-semibold"
                      style={{ color: "#1C1814" }}
                    >
                      Clicked
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-semibold"
                      style={{ color: "#1C1814" }}
                    >
                      Bounced
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-semibold"
                      style={{ color: "#1C1814" }}
                    >
                      Open Rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.allCampaigns.map((camp, idx) => (
                    <tr
                      key={camp.id}
                      style={{
                        borderBottom:
                          idx < reportData.allCampaigns.length - 1
                            ? "1px solid #E5DDD6"
                            : "none",
                        backgroundColor: idx % 2 === 0 ? "white" : "#FAFAF9",
                      }}
                    >
                      <td className="px-5 py-3 font-medium" style={{ color: "#1C1814" }}>
                        {camp.name}
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: "#7A6F68" }}>
                        {camp.stats.sent.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: "#7A6F68" }}>
                        {camp.stats.opened.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: "#7A6F68" }}>
                        {camp.stats.clicked.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: "#7A6F68" }}>
                        {camp.stats.bounced.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold"
                          style={{
                            backgroundColor: "#F0FDF4",
                            color: "#16A34A",
                            borderRadius: "6px",
                          }}
                        >
                          {camp.stats.sent > 0 ? pct(camp.stats.openRate) : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs" style={{ color: "#7A6F68" }}>
            รายงานนี้สร้างโดย LeadFlow CRM
          </p>
        </div>
      </div>
    </div>
  )
}
