"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const AGENCY_TYPES = [
  { value: "agency", label: "Agency / บริษัทการตลาด" },
  { value: "freelance", label: "Freelancer" },
  { value: "inhouse", label: "ทีม In-house" },
] as const

type AgencyType = (typeof AGENCY_TYPES)[number]["value"]

export default function OnboardingPage() {
  const router = useRouter()
  const [agencyName, setAgencyName] = useState("")
  const [workspaceName, setWorkspaceName] = useState("")
  const [agencyType, setAgencyType] = useState<AgencyType>("agency")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push("/login")
        return
      }

      // สร้าง slug จากชื่อ agency
      const slug = agencyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "agency"

      // สร้าง agency
      const { data: agency, error: agencyError } = await supabase
        .from("agencies")
        .insert({
          name: agencyName,
          slug,
          owner_id: user.id,
        })
        .select()
        .single()

      if (agencyError) throw agencyError

      // สร้าง workspace แรก
      const { data: workspace, error: wsError } = await supabase
        .from("workspaces")
        .insert({
          name: workspaceName,
          agency_id: agency.id,
          type: "agency",
        })
        .select()
        .single()

      if (wsError) throw wsError

      // เพิ่ม user เป็น agency_admin
      const { error: memberError } = await supabase
        .from("workspace_members")
        .insert({
          workspace_id: workspace.id,
          user_id: user.id,
          role: "agency_admin",
        })

      if (memberError) throw memberError

      router.push("/")
      router.refresh()
    } catch (err) {
      console.error(err)
      setError("เกิดข้อผิดพลาดในการสร้างบัญชี กรุณาลองใหม่อีกครั้ง")
      setLoading(false)
    }
  }

  return (
    <Card
      className="border-border shadow-sm"
      style={{ borderRadius: "var(--radius-card)" }}
    >
      <CardHeader className="pb-4 text-center">
        <div className="mb-2 flex justify-center">
          <span
            className="text-2xl font-extrabold tracking-tight"
            style={{ color: "var(--color-primary)" }}
          >
            LeadFlow
          </span>
        </div>
        <CardTitle
          className="text-xl font-bold"
          style={{ color: "var(--color-ink)" }}
        >
          ยินดีต้อนรับ!
        </CardTitle>
        <CardDescription style={{ color: "var(--color-muted)" }}>
          ตั้งค่าบัญชีของคุณเพื่อเริ่มต้นใช้งาน LeadFlow
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div
              className="rounded-lg border px-4 py-3 text-sm"
              style={{
                backgroundColor: "#FEF2F2",
                borderColor: "#FECACA",
                color: "var(--color-danger)",
                borderRadius: "var(--radius-input)",
              }}
            >
              {error}
            </div>
          )}

          {/* ขั้นตอนที่ 1 */}
          <div>
            <p
              className="mb-3 text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--color-muted)" }}
            >
              ข้อมูลองค์กร
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="agencyName"
                  className="text-sm font-medium"
                  style={{ color: "var(--color-ink)" }}
                >
                  ชื่อ Agency / องค์กร
                </Label>
                <Input
                  id="agencyName"
                  type="text"
                  placeholder="เช่น Best Digital Agency"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  required
                  disabled={loading}
                  className="h-10 border-border bg-white text-sm placeholder:text-muted/60"
                  style={{ borderRadius: "var(--radius-input)" }}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                  ประเภทองค์กร
                </Label>
                <div className="grid grid-cols-1 gap-2">
                  {AGENCY_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setAgencyType(type.value)}
                      disabled={loading}
                      className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-all"
                      style={{
                        borderColor:
                          agencyType === type.value ? "var(--color-primary)" : "var(--color-border)",
                        backgroundColor:
                          agencyType === type.value ? "var(--color-primary-light)" : "white",
                        color: "var(--color-ink)",
                        borderRadius: "var(--radius-input)",
                      }}
                    >
                      <div
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
                        style={{
                          borderColor:
                            agencyType === type.value ? "var(--color-primary)" : "var(--color-border)",
                        }}
                      >
                        {agencyType === type.value && (
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: "var(--color-primary)" }}
                          />
                        )}
                      </div>
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ขั้นตอนที่ 2 */}
          <div>
            <p
              className="mb-3 text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--color-muted)" }}
            >
              Workspace แรกของคุณ
            </p>
            <div className="space-y-1.5">
              <Label
                htmlFor="workspaceName"
                className="text-sm font-medium"
                style={{ color: "var(--color-ink)" }}
              >
                ชื่อ Workspace
              </Label>
              <Input
                id="workspaceName"
                type="text"
                placeholder="เช่น Main Workspace"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                required
                disabled={loading}
                className="h-10 border-border bg-white text-sm placeholder:text-muted/60"
                style={{ borderRadius: "var(--radius-input)" }}
              />
              <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                สามารถสร้าง workspace เพิ่มเติมได้ภายหลัง
              </p>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-10 w-full text-sm font-semibold text-white"
            style={{
              backgroundColor: loading ? "var(--color-primary-dark)" : "var(--color-primary)",
              borderRadius: "var(--radius-btn)",
            }}
          >
            {loading ? "กำลังสร้าง..." : "เริ่มต้นใช้งาน LeadFlow"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
