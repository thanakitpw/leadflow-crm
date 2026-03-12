# Roadmap & Checklist
## AI Lead Generation + Email Outreach System

> ติ๊ก `[x]` เมื่อทำเสร็จ | อ้างอิง [PLAN.md](./PLAN.md) สำหรับรายละเอียด

---

## Phase 0: Project Setup
> เป้าหมาย: โปรเจคพร้อม run ได้บน local

### Repository & Monorepo
- [x] สร้าง monorepo structure (`apps/web`, `apps/python-api`, `packages/`, `supabase/`, `trigger/`)
- [x] ตั้งค่า npm workspaces + Turborepo
- [x] สร้าง `.gitignore`, `.env.example`
- [x] ตั้งค่า Prettier
- [x] ตั้งค่า Python virtual env + `requirements.txt`

### Next.js App
- [x] `npx create-next-app@latest apps/web --typescript --tailwind --app`
- [x] ติดตั้ง shadcn/ui (components.json configured)
- [x] ติดตั้ง tRPC (`@trpc/server`, `@trpc/client`, `@trpc/react-query`)
- [x] ตั้งค่า folder structure (`app/(auth)`, `app/(dashboard)`)

### Python FastAPI
- [x] สร้าง `apps/python-api/` พร้อม FastAPI boilerplate
- [x] ติดตั้ง dependencies: `httpx`, `beautifulsoup4`, `dnspython`, `anthropic`
- [x] ตั้งค่า CORS สำหรับ Next.js

### Supabase
- [x] สร้าง Supabase config (`supabase/config.toml`, `migrations/`, `seed.sql`)
- [x] เชื่อมต่อ Supabase Cloud ผ่าน MCP
- [x] เพิ่ม environment variables ลง `.env`

### Trigger.dev
- [x] สร้าง Trigger.dev project structure
- [x] ติดตั้ง `@trigger.dev/sdk`
- [ ] ตั้งค่า local tunnel (`trigger dev`)

---

## Phase 1: Auth & Multi-tenant
> เป้าหมาย: Login ได้ สร้าง client workspace ได้

### Database Schema
- [x] Migration: `profiles` table (เชื่อมกับ Supabase Auth) — `20260312000001`
- [x] Migration: `agencies` table — `20260312000002`
- [x] Migration: `workspaces` table — `20260312000003`
- [x] Migration: `workspace_members` table (role: `agency_admin`, `agency_member`, `client_viewer`) — `20260312000004`
- [x] Migration: `audit_logs` table — `20260312000005`
- [x] ตั้งค่า RLS policies ทุก table (แยก data ตาม `workspace_id`)

### Auth (Supabase Auth)
- [x] หน้า Sign Up (Email + Password) — `src/app/(auth)/signup/page.tsx`
- [x] หน้า Sign In — `src/app/(auth)/login/page.tsx`
- [x] Google OAuth — ปุ่ม Sign in/Sign up with Google บน Login + Signup page, callback error handling
- [x] Email verification — Auth Callback `src/app/(auth)/callback/route.ts`
- [x] Reset password — `src/app/(auth)/forgot-password/page.tsx`

### tRPC Backend (สร้างแล้ว)
- [x] `src/lib/trpc/context.ts` — TRPCContext จาก Supabase session
- [x] `src/server/trpc.ts` — tRPC init + `protectedProcedure`
- [x] `src/server/middleware/auth.ts` — `isAuthenticated`, `isWorkspaceMember`, `isWorkspaceAdmin`
- [x] `src/server/routers/profile.ts` — `get`, `update`
- [x] `src/server/routers/agency.ts` — `get`, `create`, `update`
- [x] `src/server/routers/workspace.ts` — `list`, `getById`, `create`, `update`, `delete`
- [x] `src/server/routers/member.ts` — `list`, `invite`, `updateRole`, `remove`
- [x] `src/server/routers/_app.ts` — merge all sub-routers
- [x] `src/app/api/trpc/[trpc]/route.ts` — อัพเดทใช้ createTRPCContext

### Workspace Management
- [x] หน้า Dashboard หลัก (เลือก workspace) — `src/app/(dashboard)/page.tsx`
- [x] สร้าง Client Workspace ใหม่ — Onboarding `src/app/(auth)/onboarding/page.tsx`
- [x] Invite team member ผ่านอีเมล — `settings/members/invite-dialog.tsx` (tRPC `member.invite`)
- [x] จัดการ roles ของสมาชิก — `settings/members/member-actions.tsx` (updateRole + remove)
- [x] Agency Admin เห็นทุก workspace — RLS + workspace selection page รองรับแล้ว

### UI Pages (Phase 1 เพิ่มเติม)
- [x] Workspace Dashboard page — `[workspaceId]/page.tsx` (stats + feature cards)
- [x] Settings layout + sub-nav — `[workspaceId]/settings/layout.tsx`
- [x] General settings page — `[workspaceId]/settings/page.tsx` (rename + delete workspace)
- [x] Members settings page — `[workspaceId]/settings/members/page.tsx` (table + invite + actions)

### Middleware & Guards
- [x] Route protection (redirect ถ้าไม่ได้ login) — `src/proxy.ts`
- [x] Workspace access guard (ห้าม cross-workspace) — `[workspaceId]/layout.tsx` redirect ถ้าไม่ใช่ member
- [x] Role-based UI (ซ่อน/แสดง ตาม role) — `src/lib/permissions.ts` + Sidebar + Settings pages

---

## Phase 2: Lead Generation
> เป้าหมาย: ค้นหา leads จาก Places API + AI enrichment + scoring

### Database Schema
- [x] Migration: `leads` table (name, address, phone, website, place_id, workspace_id, status) — `20260312000010`
- [x] Migration: `lead_scores` table (score, reasoning, scored_at) — `20260312000010`
- [x] Migration: `lead_tags` table — `20260312000010`
- [x] Migration: `places_cache` table (cache_key, results JSON, expires_at, hit_count) — `20260312000010`
- [x] RLS policies สำหรับทุก table

### Places API Integration (Python FastAPI)
- [x] `POST /api/v1/places/search` endpoint (keyword + lat/lng + radius)
- [x] Radius bucketing (500 / 1000 / 2000 / 5000m) ก่อน cache — `app/services/cache.py`
- [x] Cache check → HIT ส่งผลทันที / MISS → call API → บันทึก cache
- [x] Cache TTL: list = 7 วัน, details = 30 วัน
- [x] increment `hit_count` ทุกครั้งที่ cache hit — `app/services/cache.py`
- [x] Log cache hit/miss ratio ใน batch search — `app/api/v1/endpoints/places.py`
- [x] Nearby Search (`searchNearby`) สำหรับ category preset — `app/services/places.py`
- [x] `GET /api/v1/places/details/{place_id}` endpoint (TTL 30 วัน)
- [x] Handle pagination (Places API ให้ 20 results/call, max 60) — `app/services/places.py` + `app/schemas/places.py`
- [x] Category presets: F&B / SME / อสังหาฯ / B2B — `app/services/places.py`
- [x] Batch search (หลาย keyword พร้อมกัน) — `POST /api/v1/places/search-batch`
- [x] CORS ใช้ `settings.cors_origins` แบบ dynamic — `main.py` + `app/core/config.py`

### AI Email Finder (Python FastAPI)
- [x] `POST /api/v1/enrichment/find-email` endpoint — `app/api/v1/endpoints/enrichment.py`
- [x] Step 1: Scrape website ด้วย httpx (homepage + /contact + /about + /team + /เกี่ยวกับเรา) — `app/services/scraper.py`
- [x] Step 2: Playwright fallback สำหรับเว็บที่ใช้ JavaScript
- [x] Step 3: Regex หา email + mailto: links — `app/services/email_finder.py`
- [x] Step 4: Claude extract email จาก page content — `app/services/email_finder.py`
- [x] Step 5: Pattern guess (info@, contact@, hello@, sales@, admin@) — `app/services/email_finder.py`
- [x] Step 6: MX Record validation (dnspython, timeout 3s, in-memory cache) — `app/services/mx_validator.py`
- [x] บันทึก confidence score ต่อ email ที่เจอ (mailto=95, scraped=90, regex=80, claude=75, pattern=50)
- [x] Respect robots.txt (ไม่ scrape path ที่ disallowed) — `app/services/scraper.py`
- [x] Rate limiting: max 2 req/sec per domain (Semaphore + 0.5s sleep) — `app/services/scraper.py`
- [x] Handle encoding: UTF-8 + TIS-620 fallback สำหรับเว็บไทย — `app/services/scraper.py`
- [x] Schemas: `app/schemas/enrichment.py` (EmailFinderRequest, EmailResult, EmailFinderResponse)

### Claude Lead Scoring Agent
- [x] `POST /api/v1/scoring/score` endpoint — `app/api/v1/endpoints/scoring.py`
- [x] `POST /api/v1/scoring/score-batch` endpoint (max 10 leads, batch in 1 Claude call)
- [x] Claude วิเคราะห์: rating, reviews count, website, has email, category, location — `app/services/scorer.py`
- [x] ให้คะแนน 0-100 + เหตุผลสั้น ๆ ภาษาไทย
- [x] บันทึก score + reasoning ลง `lead_scores` — `app/services/lead_score_store.py` + endpoint integration
- [x] Batch scoring ส่ง context ทั้งหมดใน 1 Claude call + fallback เป็น concurrent individual — `app/services/scorer.py`
- [x] Fallback เมื่อไม่มี API key: return score = 50, reasoning = "ไม่มี API key สำหรับ AI scoring"
- [x] Schemas: `app/schemas/scoring.py` (LeadForScoring, ScoreResult, ScoreLeadRequest/Response, ScoreBatchRequest/Response)

### Agent Orchestration
- [ ] Orchestrator Agent รับ search request
- [ ] Lead Finder Agent ค้นหา + cache
- [ ] Enrichment Agents run แบบ parallel (asyncio)
- [ ] Scoring Agent process batch
- [ ] อัพเดทสถานะ lead realtime (Supabase Realtime)

### Lead Management UI (Next.js)
- [x] หน้าค้นหา leads (search form + category presets + city presets + radius slider) — `leads/search/page.tsx` (รองรับ bulk select + checkbox + "บันทึก X leads")
- [x] ตารางแสดง leads (sortable, filterable) — `leads/page.tsx` + `lead-list-client.tsx`
- [x] Lead card: ชื่อ, คะแนน, อีเมล, เบอร์, ที่อยู่, เว็บ, สถานะ
- [x] Bulk select + bulk delete (confirm dialog) + export CSV เฉพาะที่เลือก
- [x] Filter: by status, has email, sort by score/date/name
- [x] CSV export (ใช้ `lead.exportCsv` tRPC)
- [x] Duplicate detection (server-side via place_id conflict)
- [x] Lead detail page (AI score, tags, notes, status, actions) — `leads/[leadId]/page.tsx` + `lead-detail-client.tsx`
- [x] Tag Manager component (แยกออกมา) — `leads/[leadId]/tag-manager.tsx`
- [x] Notes Editor component (auto-save + indicator) — `leads/[leadId]/notes-editor.tsx`

### tRPC Lead Router — `src/server/routers/lead.ts`
- [x] `lead.list` — filter, sort, pagination
- [x] `lead.getById` — พร้อม scores, tags
- [x] `lead.create` — สร้างจาก Places result (duplicate check via place_id)
- [x] `lead.createBulk` — bulk save (max 50)
- [x] `lead.update` — status, email, notes
- [x] `lead.delete` — ลบ lead เดียว
- [x] `lead.deleteBulk` — ลบหลาย leads
- [x] `lead.addTag` — เพิ่ม tag
- [x] `lead.removeTag` — ลบ tag
- [x] `lead.exportCsv` — ส่ง CSV data พร้อม headers ภาษาไทย

---

## Phase 3: Email Outreach
> เป้าหมาย: ส่ง email campaign + sequence ได้ + track ผล

### Database Schema
- [ ] Migration: `sending_domains` table (domain, dkim_status, spf_status, workspace_id)
- [ ] Migration: `email_templates` table (name, subject, body_html, variables, workspace_id)
- [ ] Migration: `campaigns` table (name, template_id, status, scheduled_at, workspace_id)
- [ ] Migration: `campaign_contacts` table (campaign_id, lead_id, status, sent_at)
- [ ] Migration: `sequences` table (name, workspace_id)
- [ ] Migration: `sequence_steps` table (sequence_id, step_number, template_id, delay_days, condition)
- [ ] Migration: `sequence_enrollments` table (sequence_id, lead_id, current_step, status)
- [ ] Migration: `email_events` table (type: sent/open/click/bounce/complaint, lead_id, campaign_id, occurred_at)
- [ ] Migration: `unsubscribes` table (email, workspace_id, unsubscribed_at)
- [ ] RLS policies ทุก table

### Email Domain Setup
- [ ] UI สำหรับ add sending domain
- [ ] Generate SPF record แนะนำ
- [ ] Generate DKIM record แนะนำ
- [ ] Generate DMARC record แนะนำ
- [ ] DNS verification check
- [ ] Warm-up scheduler config (เริ่มส่งกี่อีเมล/วัน แล้วค่อย ๆ เพิ่ม)

### Email Templates
- [ ] Template editor (React Email + preview)
- [ ] Variable system: `{{first_name}}`, `{{business_name}}`, `{{location}}`, `{{custom}}`
- [ ] Template categories (F&B, SME, อสังหาฯ, B2B, Follow-up)
- [ ] Duplicate template
- [ ] Test send (ส่งให้ตัวเองดูก่อน)

### Claude Email Writer Agent
- [ ] `/api/email/generate` endpoint
- [ ] รับ lead profile → Claude เขียนอีเมล personalized (ภาษาไทย/อังกฤษ)
- [ ] Claude แนะนำ subject line (2-4 คำ)
- [ ] Tone options: formal / friendly / casual
- [ ] Generate A/B variant (2 version)

### Email Campaigns (One-time)
- [ ] สร้าง campaign (เลือก template + audience)
- [ ] Audience: จาก leads ทั้งหมด / tag / score range
- [ ] Preview campaign ก่อนส่ง (จำนวน recipients, ตัวอย่าง email)
- [ ] Schedule ส่ง (วัน/เวลา)
- [ ] Daily sending limit per domain
- [ ] ส่งผ่าน Resend API
- [ ] Track sent status realtime

### Email Sequences (Drip)
- [ ] สร้าง sequence + กำหนด steps
- [ ] Step config: template, delay (วัน), condition (ถ้า open / ถ้าไม่ open)
- [ ] Enroll leads เข้า sequence (manual หรือ auto)
- [ ] Trigger.dev job: `process-sequence-step` ทำงานทุกวัน
  - [ ] หา enrollments ที่ถึงเวลาส่ง step ถัดไป
  - [ ] เช็ค condition (open/reply)
  - [ ] ส่งอีเมล → อัพเดท step
  - [ ] Auto-stop เมื่อมี reply
- [ ] Timezone-aware (ส่งตาม timezone ของ recipient)

### Email Tracking
- [ ] Open tracking: embed tracking pixel ใน email
- [ ] Click tracking: redirect URL
- [ ] Resend Webhook endpoint (`/api/webhooks/resend`)
  - [ ] Handle: `email.sent`, `email.opened`, `email.clicked`
  - [ ] Handle: `email.bounced`, `email.complained`
  - [ ] บันทึกลง `email_events`
- [ ] Auto-unsubscribe เมื่อ complaint
- [ ] Unsubscribe link ใน footer ทุก email
- [ ] Bounce management (stop ส่งถ้า hard bounce)

### Email Management UI (Next.js)
- [ ] หน้า Campaigns (list, status, stats)
- [ ] Campaign detail: sent / open rate / click rate / bounce rate
- [ ] หน้า Sequences (list, active enrollments)
- [ ] Sequence builder (visual step editor)
- [ ] Template library
- [ ] Domain settings
- [ ] Unsubscribe list

---

## Phase 4: เชื่อม 2 ระบบ + Dashboard
> เป้าหมาย: Lead → Email Sequence ได้เลย + Agency dashboard

### Lead → Email Integration
- [ ] ปุ่ม "Enroll in Sequence" จาก Lead list
- [ ] Bulk enroll (เลือกหลาย leads → enroll sequence)
- [ ] Lead status อัพเดทเมื่อมี email activity (emailed, replied, etc.)

### Agency Dashboard
- [ ] Overview: Leads generated, Emails sent, Open rate, Reply rate
- [ ] Per-workspace stats
- [ ] Team activity feed

### Client Report
- [ ] หน้า report per workspace (leads, campaign performance)
- [ ] Shareable link (token-based, ไม่ต้อง login)
- [ ] Export PDF

---

## Phase 5: CRM Layer
> เป้าหมาย: จัดการ contacts, deals, pipeline

### Database Schema
- [ ] Migration: `contacts` table
- [ ] Migration: `companies` table
- [ ] Migration: `contact_companies` table
- [ ] Migration: `deals` table
- [ ] Migration: `pipelines` + `pipeline_stages` table
- [ ] Migration: `activities` table (polymorphic)
- [ ] Migration: `notes`, `tasks` table

### Contact Management
- [ ] Convert lead → contact (1 click)
- [ ] Contact list + search + filter
- [ ] Contact detail page (info, activity timeline, email history)
- [ ] Custom fields
- [ ] Tags & segments
- [ ] Import contacts (CSV)

### Pipeline & Deals
- [ ] Kanban board (drag & drop)
- [ ] Custom stages per pipeline
- [ ] Deal value + expected close date
- [ ] Win/Loss tracking
- [ ] Deal → Contact link

---

## Phase 6: Scale & Optimize
> เมื่อระบบโตขึ้น

### Email Service Migration
- [ ] สร้าง Email Service Layer (abstract interface)
- [ ] Verify domain บน AWS SES
- [ ] ขอ SES production access
- [ ] Warm-up dedicated IP (2-4 สัปดาห์)
- [ ] Handle SES bounce/complaint ผ่าน SNS
- [ ] Switch campaign → AWS SES เมื่อ > 50k emails/เดือน
- [ ] คง Resend ไว้สำหรับ transactional (OTP, notifications)

### Performance
- [ ] Places API cache เต็มรูปแบบ
- [ ] Email queue rate limiting (ป้องกัน burst)
- [ ] Database indexes ที่จำเป็น
- [ ] Supabase upgrade → Pro plan เมื่อ data โต

### SaaS Readiness
- [ ] Billing integration (Stripe)
- [ ] Plan limits enforcement (leads/mo, emails/mo per plan)
- [ ] Usage tracking per workspace
- [ ] Onboarding flow สำหรับ new client
- [ ] White-label (custom domain สำหรับ client portal)

---

## สรุป Timeline

| Phase | สิ่งที่ได้ | ระยะเวลา |
|---|---|---|
| **0** | Project setup พร้อม run local | 1-2 วัน |
| **1** | Login + Workspace management | 3-5 วัน |
| **2** | Lead Generation + AI Enrichment + Scoring | 1-2 สัปดาห์ |
| **3** | Email Campaigns + Sequences + Tracking | 1-2 สัปดาห์ |
| **4** | เชื่อม 2 ระบบ + Dashboard + Reports | 1 สัปดาห์ |
| **5** | CRM (Contacts, Pipeline, Deals) | 2-3 สัปดาห์ |
| **6** | Scale, AWS SES, Billing, SaaS-ready | ongoing |

---

## ความคืบหน้า

```
Phase 0: Project Setup        [~] 15/16 tasks
Phase 1: Auth & Multi-tenant  [x] 30/30 tasks ← Phase 1 เสร็จสมบูรณ์แล้ว
Phase 2: Lead Generation      [~] 45/49 tasks  ← เหลือ Agent Orchestration (4 tasks)
Phase 3: Email Outreach       [ ] 0/35 tasks
Phase 4: เชื่อม 2 ระบบ        [ ] 0/7  tasks
Phase 5: CRM Layer            [ ] 0/15 tasks
Phase 6: Scale & Optimize     [ ] 0/12 tasks

รวม: 90/147 tasks
```
