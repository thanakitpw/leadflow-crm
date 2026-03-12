"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  Globe,
  Plus,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react"
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
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"

// ============================================================
// Types
// ============================================================

interface DnsRecord {
  type: "TXT"
  host: string
  value: string
}

interface DomainWithDns {
  id: string
  domain: string
  status: string
  dkim_verified: boolean
  spf_verified: boolean
  dmarc_verified: boolean
  daily_limit: number
  warmup_enabled: boolean
  created_at: string
  last_verified_at?: string | null
  dkim_selector?: string
  dnsRecords?: {
    dkim: DnsRecord
    spf: DnsRecord
    dmarc: DnsRecord
  }
}

// ============================================================
// Helpers
// ============================================================

function DnsStatusBadge({ verified, label }: { verified: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {verified ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "#16A34A" }} />
      ) : (
        <XCircle className="h-3.5 w-3.5 shrink-0" style={{ color: "#DC2626" }} />
      )}
      <span
        className="text-xs font-medium"
        style={{ color: verified ? "#16A34A" : "#DC2626" }}
      >
        {label}
      </span>
    </div>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors hover:bg-slate-100"
      style={{ color: copied ? "#16A34A" : "var(--color-muted)" }}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "คัดลอกแล้ว" : "คัดลอก"}
    </button>
  )
}

// ============================================================
// Component
// ============================================================

export default function DomainsSettingsPage() {
  const params = useParams()
  const workspaceId = params.workspaceId as string

  const [domains, setDomains] = useState<DomainWithDns[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add domain dialog
  const [addOpen, setAddOpen] = useState(false)
  const [newDomain, setNewDomain] = useState("")
  const [newDailyLimit, setNewDailyLimit] = useState("500")
  const [adding, setAdding] = useState(false)
  const [addedDomain, setAddedDomain] = useState<DomainWithDns | null>(null)

  // DNS records dialog
  const [dnsOpen, setDnsOpen] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<DomainWithDns | null>(null)
  const [dnsRecords, setDnsRecords] = useState<{
    dkim: DnsRecord
    spf: DnsRecord
    dmarc: DnsRecord
  } | null>(null)
  const [loadingDns, setLoadingDns] = useState(false)

  // Delete dialog
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Verify loading
  const [verifyingId, setVerifyingId] = useState<string | null>(null)

  const fetchDomains = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await trpc.domain.list.query({ workspaceId })
      setDomains(result as DomainWithDns[])
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถดึงรายการ domains ได้"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    fetchDomains()
  }, [fetchDomains])

  const handleAdd = async () => {
    if (!newDomain.trim()) {
      toast.error("กรุณาใส่ชื่อ domain")
      return
    }
    setAdding(true)
    try {
      const result = await trpc.domain.add.mutate({
        workspaceId,
        domain: newDomain.trim().toLowerCase(),
        dailyLimit: parseInt(newDailyLimit) || 500,
      })
      toast.success("เพิ่ม domain แล้ว")
      setAddedDomain(result as DomainWithDns)
      setNewDomain("")
      setNewDailyLimit("500")
      fetchDomains()
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถเพิ่ม domain ได้"
      toast.error(msg)
    } finally {
      setAdding(false)
    }
  }

  const handleVerify = async (domainId: string) => {
    setVerifyingId(domainId)
    try {
      const result = await trpc.domain.verify.mutate({ workspaceId, domainId })
      const { dkim, spf, dmarc } = result.verificationResult
      if (dkim && spf) {
        toast.success("ยืนยัน DNS สำเร็จ!")
      } else {
        toast.warning(
          `ยังพบปัญหา DNS: ${!dkim ? "DKIM" : ""} ${!spf ? "SPF" : ""} ${!dmarc ? "DMARC" : ""}`.trim(),
        )
      }
      fetchDomains()
    } catch {
      toast.error("ไม่สามารถตรวจสอบ DNS ได้")
    } finally {
      setVerifyingId(null)
    }
  }

  const handleShowDns = async (domain: DomainWithDns) => {
    setSelectedDomain(domain)
    setDnsOpen(true)
    setLoadingDns(true)
    try {
      const result = await trpc.domain.getDnsRecords.query({
        workspaceId,
        domainId: domain.id,
      })
      setDnsRecords(result)
    } catch {
      toast.error("ไม่สามารถดึง DNS records ได้")
    } finally {
      setLoadingDns(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setDeleteLoading(true)
    try {
      await trpc.domain.delete.mutate({ workspaceId, domainId: deletingId })
      toast.success("ลบ domain แล้ว")
      setDeleteOpen(false)
      setDeletingId(null)
      fetchDomains()
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "ไม่สามารถลบ domain ได้"
      toast.error(msg)
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-canvas)" }}>
      <div className="px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
              Sending Domains
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
              จัดการ domains สำหรับส่งอีเมลและตรวจสอบ DNS records
            </p>
          </div>
          <Button
            onClick={() => setAddOpen(true)}
            style={{
              backgroundColor: "var(--color-primary)",
              borderRadius: "var(--radius-btn)",
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            เพิ่ม Domain
          </Button>
        </div>

        {/* Domain table */}
        <div
          className="rounded-xl border bg-white shadow-sm"
          style={{ borderColor: "var(--color-border)", borderRadius: "var(--radius-card)" }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2
                className="h-6 w-6 animate-spin"
                style={{ color: "var(--color-primary)" }}
              />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20">
              <AlertTriangle className="h-8 w-8" style={{ color: "#DC2626" }} />
              <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                {error}
              </p>
              <Button variant="outline" size="sm" onClick={fetchDomains}>
                ลองใหม่
              </Button>
            </div>
          ) : domains.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--color-primary-light)" }}
              >
                <Globe className="h-7 w-7" style={{ color: "var(--color-primary)" }} />
              </div>
              <p className="font-medium" style={{ color: "var(--color-ink)" }}>
                ยังไม่มี domains
              </p>
              <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                เพิ่ม domain เพื่อเริ่มส่งอีเมล
              </p>
              <Button
                size="sm"
                onClick={() => setAddOpen(true)}
                style={{
                  backgroundColor: "var(--color-primary)",
                  borderRadius: "var(--radius-btn)",
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                เพิ่ม Domain แรก
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: "var(--color-border)" }}>
                  <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                    Domain
                  </TableHead>
                  <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                    DNS Status
                  </TableHead>
                  <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                    สถานะ
                  </TableHead>
                  <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                    Daily Limit
                  </TableHead>
                  <TableHead className="font-semibold" style={{ color: "var(--color-ink)" }}>
                    Warmup
                  </TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((domain) => (
                  <TableRow
                    key={domain.id}
                    className="group transition-colors hover:bg-slate-50"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    {/* Domain */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Globe
                          className="h-4 w-4 shrink-0"
                          style={{ color: "var(--color-muted)" }}
                        />
                        <span className="font-medium" style={{ color: "var(--color-ink)" }}>
                          {domain.domain}
                        </span>
                      </div>
                    </TableCell>

                    {/* DNS Status */}
                    <TableCell>
                      <div className="space-y-1">
                        <DnsStatusBadge verified={domain.dkim_verified} label="DKIM" />
                        <DnsStatusBadge verified={domain.spf_verified} label="SPF" />
                        <DnsStatusBadge verified={domain.dmarc_verified} label="DMARC" />
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <span
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium"
                        style={{
                          color:
                            domain.status === "verified"
                              ? "#16A34A"
                              : domain.status === "pending"
                              ? "#D97706"
                              : "#DC2626",
                          backgroundColor:
                            domain.status === "verified"
                              ? "#F0FDF4"
                              : domain.status === "pending"
                              ? "#FEF3C7"
                              : "#FEF2F2",
                          borderRadius: "var(--radius-badge)",
                        }}
                      >
                        {domain.status === "verified" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {domain.status === "verified"
                          ? "Verified"
                          : domain.status === "pending"
                          ? "Pending"
                          : "Failed"}
                      </span>
                    </TableCell>

                    {/* Daily Limit */}
                    <TableCell>
                      <span className="text-sm" style={{ color: "var(--color-ink)" }}>
                        {domain.daily_limit.toLocaleString()} / วัน
                      </span>
                    </TableCell>

                    {/* Warmup */}
                    <TableCell>
                      <span
                        className="inline-flex rounded px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: domain.warmup_enabled ? "#F0FDF4" : "#F5F0EB",
                          color: domain.warmup_enabled ? "#16A34A" : "#7A6F68",
                          borderRadius: "var(--radius-badge)",
                        }}
                      >
                        {domain.warmup_enabled ? "เปิด" : "ปิด"}
                      </span>
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => handleShowDns(domain)}
                          style={{ borderRadius: "var(--radius-btn)" }}
                        >
                          DNS
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => handleVerify(domain.id)}
                          disabled={verifyingId === domain.id}
                          style={{ borderRadius: "var(--radius-btn)" }}
                        >
                          {verifyingId === domain.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          ตรวจสอบ
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setDeletingId(domain.id)
                            setDeleteOpen(true)
                          }}
                          style={{ color: "var(--color-danger)" }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Add Domain Dialog */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) setAddedDomain(null)
        }}
      >
        <DialogContent style={{ borderRadius: "var(--radius-modal)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--color-ink)" }}>เพิ่ม Sending Domain</DialogTitle>
            <DialogDescription style={{ color: "var(--color-muted)" }}>
              ใส่ domain ที่ต้องการใช้ส่งอีเมล แล้วตั้งค่า DNS records ตามที่ระบุ
            </DialogDescription>
          </DialogHeader>

          {!addedDomain ? (
            <>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label style={{ color: "var(--color-ink)" }}>
                    Domain <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="เช่น mail.yourdomain.com"
                    style={{ borderRadius: "var(--radius-input)" }}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label style={{ color: "var(--color-ink)" }}>Daily Sending Limit</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    value={newDailyLimit}
                    onChange={(e) => setNewDailyLimit(e.target.value)}
                    style={{ borderRadius: "var(--radius-input)" }}
                  />
                  <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                    แนะนำ 100-500 สำหรับ domain ใหม่ เพื่อ warm up
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAddOpen(false)}
                  disabled={adding}
                >
                  ยกเลิก
                </Button>
                <Button
                  onClick={handleAdd}
                  disabled={adding || !newDomain.trim()}
                  style={{
                    backgroundColor: "var(--color-primary)",
                    borderRadius: "var(--radius-btn)",
                  }}
                >
                  {adding ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  เพิ่ม Domain
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-4 py-2">
                <div
                  className="flex items-center gap-2 rounded-lg p-3"
                  style={{
                    backgroundColor: "#F0FDF4",
                    borderRadius: "var(--radius-card)",
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "#16A34A" }} />
                  <p className="text-sm font-medium" style={{ color: "#16A34A" }}>
                    เพิ่ม {addedDomain.domain} แล้ว — กรุณาตั้งค่า DNS
                  </p>
                </div>

                {addedDomain.dnsRecords && (
                  <div className="space-y-3">
                    {Object.entries(addedDomain.dnsRecords).map(([key, record]) => (
                      <div
                        key={key}
                        className="rounded-lg border p-3"
                        style={{
                          borderColor: "var(--color-border)",
                          borderRadius: "var(--radius-input)",
                        }}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span
                            className="text-xs font-semibold uppercase"
                            style={{ color: "var(--color-primary)" }}
                          >
                            {key.toUpperCase()} — {record.type}
                          </span>
                          <CopyButton value={record.value} />
                        </div>
                        <p className="text-xs font-mono" style={{ color: "var(--color-muted)" }}>
                          Host: {record.host}
                        </p>
                        <p
                          className="mt-1 break-all text-xs font-mono"
                          style={{ color: "var(--color-ink)" }}
                        >
                          {record.value}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  onClick={() => {
                    setAddOpen(false)
                    setAddedDomain(null)
                  }}
                  style={{
                    backgroundColor: "var(--color-primary)",
                    borderRadius: "var(--radius-btn)",
                  }}
                >
                  เข้าใจแล้ว
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* DNS Records Dialog */}
      <Dialog open={dnsOpen} onOpenChange={setDnsOpen}>
        <DialogContent style={{ borderRadius: "var(--radius-modal)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--color-ink)" }}>
              DNS Records — {selectedDomain?.domain}
            </DialogTitle>
            <DialogDescription style={{ color: "var(--color-muted)" }}>
              ตั้งค่า DNS records เหล่านี้ใน DNS provider ของคุณ
            </DialogDescription>
          </DialogHeader>

          {loadingDns ? (
            <div className="flex items-center justify-center py-8">
              <Loader2
                className="h-5 w-5 animate-spin"
                style={{ color: "var(--color-primary)" }}
              />
            </div>
          ) : dnsRecords ? (
            <div className="space-y-3 py-2">
              {Object.entries(dnsRecords).map(([key, record]) => (
                <div
                  key={key}
                  className="rounded-lg border p-3"
                  style={{
                    borderColor: "var(--color-border)",
                    borderRadius: "var(--radius-input)",
                  }}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className="text-xs font-semibold uppercase"
                      style={{ color: "var(--color-primary)" }}
                    >
                      {key.toUpperCase()} — {record.type}
                    </span>
                    <CopyButton value={record.value} />
                  </div>
                  <p className="text-xs font-mono" style={{ color: "var(--color-muted)" }}>
                    Host: {record.host}
                  </p>
                  <p
                    className="mt-1 break-all text-xs font-mono"
                    style={{ color: "var(--color-ink)" }}
                  >
                    {record.value}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              onClick={() => selectedDomain && handleVerify(selectedDomain.id)}
              variant="outline"
              disabled={verifyingId === selectedDomain?.id}
              className="gap-2"
              style={{ borderRadius: "var(--radius-btn)" }}
            >
              {verifyingId === selectedDomain?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              ตรวจสอบ DNS
            </Button>
            <Button
              onClick={() => setDnsOpen(false)}
              style={{
                backgroundColor: "var(--color-primary)",
                borderRadius: "var(--radius-btn)",
              }}
            >
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Domain Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent style={{ borderRadius: "var(--radius-modal)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--color-ink)" }}>ยืนยันการลบ Domain</DialogTitle>
            <DialogDescription style={{ color: "var(--color-muted)" }}>
              คุณต้องการลบ domain นี้ใช่หรือไม่? Campaigns ที่ใช้ domain นี้อยู่อาจไม่สามารถส่งได้
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
              ลบ Domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
