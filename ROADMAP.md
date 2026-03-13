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
- [x] Orchestrator Agent รับ search request — `app/services/orchestrator.py` + `app/api/v1/endpoints/orchestrator.py`
- [x] Lead Finder Agent ค้นหา + cache — `_search_places_cached()` ใน orchestrator service
- [x] Enrichment Agents run แบบ parallel (asyncio) — `_enrich_emails()` ด้วย Semaphore(3) + timeout 30s
- [x] Scoring Agent process batch — `_score_leads()` เรียก `score_leads_batch()` + fallback
- [x] Supabase REST API helper — `app/services/supabase_client.py` (insert, insert_many, select, upsert, check_exists)
- [x] บันทึก leads + lead_scores ลง Supabase ด้วย ON CONFLICT upsert — `_save_leads()` ใน orchestrator
- [x] Schemas: `app/schemas/orchestrator.py` (OrchestrationRequest, EnrichedLead, OrchestrationResponse)
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
- [x] Migration: `sending_domains` table (domain, dkim_status, spf_status, workspace_id) — `20260312000020`
- [x] Migration: `email_templates` table (name, subject, body_html, variables, workspace_id) — `20260312000020`
- [x] Migration: `campaigns` table (name, template_id, status, scheduled_at, workspace_id) — `20260312000020`
- [x] Migration: `campaign_contacts` table (campaign_id, lead_id, status, sent_at) — `20260312000020`
- [x] Migration: `sequences` table (name, workspace_id) — `20260312000020`
- [x] Migration: `sequence_steps` table (sequence_id, step_number, template_id, delay_days, condition) — `20260312000020`
- [x] Migration: `sequence_enrollments` table (sequence_id, lead_id, current_step, status) — `20260312000020`
- [x] Migration: `email_events` table (type: sent/open/click/bounce/complaint, lead_id, campaign_id, occurred_at) — `20260312000020`
- [x] Migration: `unsubscribes` table (email, workspace_id, unsubscribed_at) — `20260312000020`
- [x] RLS policies ทุก table

### Email Domain Setup
- [x] UI สำหรับ add sending domain — `settings/domains/page.tsx` + `domain.ts` tRPC router
- [x] Generate SPF record แนะนำ — `domain_manager.generate_dns_records()`
- [x] Generate DKIM record แนะนำ (placeholder จาก Resend Dashboard)
- [x] Generate DMARC record แนะนำ
- [x] DNS verification check (dnspython SPF + DMARC + DKIM) — `domain_manager.verify_domain()`
- [x] Warm-up scheduler config (Day 1-3: 10/d, 4-7: 25/d, 8-14: 50/d, 15-21: 100/d, 22+: full) — `domain_manager.calculate_warmup_limit()`

### Email Templates
- [x] Template editor (split-view HTML editor + live preview) — `templates/[templateId]/page.tsx`
- [x] Variable system: `{{first_name}}`, `{{business_name}}`, `{{location}}`, `{{category}}`, etc. — `src/lib/email/template-variables.ts`
- [x] Template categories (Cold Outreach, Follow Up, Introduction, Promotion, Newsletter, Re-engagement) — template editor + list filter
- [x] Duplicate template — `template.duplicate` tRPC procedure
- [x] Test send (ส่งให้ตัวเองดูก่อน) — `template.testSend` tRPC mutation + Python API (2026-03-14)

### Claude Email Writer Agent
- [x] `POST /api/v1/email/generate` endpoint — `app/api/v1/endpoints/email.py`
- [x] รับ lead profile → Claude เขียนอีเมล personalized (ภาษาไทย/อังกฤษ) — `app/services/email_writer.py`
- [x] Claude แนะนำ subject line — `POST /api/v1/email/suggest-subjects`
- [x] Tone options: formal / friendly / casual
- [x] Generate A/B variant (2 version) — `POST /api/v1/email/generate-ab`

### Email Campaigns (One-time)
- [x] สร้าง campaign (เลือก template + audience) — `campaigns/create/page.tsx` + `campaign.create` tRPC
- [x] Audience: จาก leads ทั้งหมด / score range / status filter — `campaign.previewAudience` tRPC
- [x] Preview campaign ก่อนส่ง (จำนวน recipients) — audience preview ใน create form
- [x] Schedule ส่ง (วัน/เวลา) — `campaign.schedule` tRPC + UI toggle
- [x] Daily sending limit per domain (warmup_current_limit) — `src/lib/email/send-campaign.ts` + `domain_manager.calculate_warmup_limit()`
- [x] ส่งผ่าน Python API (`POST /api/v1/email/send`) — `app/services/email_sender.py` + `app/api/v1/endpoints/email.py`
- [x] `POST /api/v1/email/send-batch` (max 100, asyncio.gather + Semaphore(10)) — `app/services/email_sender.py`
- [x] Campaign Send Integration — เชื่อม `sendCampaign()` กับ campaign router (2026-03-14)
  - [x] แก้ `callPythonEmailSend` ให้ embed `from_name` ใน `"Name <email>"` format (Python API ไม่มี `from_name` field)
  - [x] แก้ status check ใน `sendCampaign` รองรับ `'sending'` (บน line 186)
  - [x] `POST /api/internal/campaign-send` — internal route รับ `campaignId` แล้วเรียก `sendCampaign()`
  - [x] `campaign.schedule` tRPC — trigger send ทันทีถ้าไม่มี `scheduledAt` (fire-and-forget)
  - [x] `campaign.sendNow` tRPC — ส่งทันทีจากหน้า campaign detail (validate status + template)
  - [x] `GET /api/cron/process-scheduled-campaigns` — cron route หา scheduled campaigns ที่ถึงเวลา → trigger send
- [ ] Track sent status realtime

### Email Sequences (Drip)
- [x] สร้าง sequence + กำหนด steps — `sequences/[sequenceId]/page.tsx` (visual timeline builder)
- [x] Step config: template, delay (วัน) — `sequence.addStep` / `sequence.updateStep` tRPC
- [x] Enroll leads เข้า sequence (manual) — `sequence.enrollLeads` tRPC
- [x] Fix DB column name mismatch: `step_order` → `step_number` ใน `sequence.ts` router (getById select/order, addStep insert, updateStep input+update)
- [x] Sequence processing engine — `src/lib/email/process-sequences.ts` (processSequences: load active enrollments, check delay, send via Python API, update current_step + last_step_at, record email_events, mark completed)
- [x] Cron route — `src/app/api/cron/process-sequences/route.ts` (GET, Bearer auth via CRON_SECRET)
- [ ] Trigger.dev job: `process-sequence-step` เรียก processSequences ทุก 30 นาที
  - [ ] เช็ค condition (open/reply) ก่อนส่ง step ถัดไป
  - [ ] Auto-stop เมื่อมี reply
- [ ] Timezone-aware (ส่งตาม timezone ของ recipient)

### Email Tracking
- [x] Open tracking: embed tracking pixel ใน email — `src/app/api/track/open/[eventId]/route.ts` + `app/api/v1/endpoints/tracking.py`
- [x] Click tracking: redirect URL — `src/app/api/track/click/[eventId]/route.ts` + `GET /api/v1/track/click/{event_id}`
- [x] Tracking pixel inject + link wrap + unsubscribe inject — `app/services/tracking.py`
- [x] Resend Webhook endpoint (`/api/webhooks/resend`) — `src/app/api/webhooks/resend/route.ts` + `POST /api/v1/webhooks/resend`
  - [x] Handle: `email.sent`, `email.delivered`, `email.opened`, `email.clicked`
  - [x] Handle: `email.bounced`, `email.complained`
  - [x] บันทึกลง `email_events`
- [x] Auto-unsubscribe เมื่อ complaint
- [x] Unsubscribe link ใน footer ทุก email — `app/services/tracking.py` + `tracking_service.generate_unsubscribe_link()`
- [x] Unsubscribe handler page (GET confirm + POST process) — `src/app/api/unsubscribe/[token]/route.ts` + `GET /api/v1/unsubscribe/{token}`
- [ ] Bounce management (stop ส่งถ้า hard bounce)

### Email Management UI (Next.js)
- [x] หน้า Campaigns (list, status, stats) — `campaigns/page.tsx` + `campaign-list-client.tsx`
- [x] Campaign detail: sent / open rate / click rate / bounce rate + contacts table — `campaigns/[campaignId]/page.tsx`
- [x] สร้าง Campaign form (template, domain, audience filter, schedule) — `campaigns/create/page.tsx`
- [x] หน้า Sequences (list, active enrollments) — `sequences/page.tsx` + `sequence-list-client.tsx`
- [x] Sequence builder (visual step editor + enrollments panel) — `sequences/[sequenceId]/page.tsx`
- [x] Template library (grid cards + category filter) — `templates/page.tsx` + `template-list-client.tsx`
- [x] Template editor (split-view HTML + live preview) — `templates/[templateId]/page.tsx`
- [x] Domain settings (DNS records + verify) — `settings/domains/page.tsx`
- [ ] Unsubscribe list

---

## Phase 4: เชื่อม 2 ระบบ + Dashboard
> เป้าหมาย: Lead → Email Sequence ได้เลย + Agency dashboard

### Database Schema
- [x] Migration: `client_reports` table (share_token, date_from, date_to, config, expires_at) — `20260312000030`
- [x] Migration: `activity_feed` table (action, entity_type, entity_id, metadata, user_id) — `20260312000030`
- [x] View: `workspace_stats` (total_leads, new_leads, leads_with_email, campaign stats, email event counts) — `20260312000030`
- [x] Function: `get_report_by_token(token)` — SECURITY DEFINER สำหรับ public share link — `20260312000030`
- [x] Function: `cleanup_old_activity_feed(days)` — retention cleanup — `20260312000030`
- [x] RLS policies: client_reports (CRUD for members, admin-only delete) + activity_feed (SELECT+INSERT for members, append-only)
- [x] Indexes: activity_feed(workspace_id, created_at DESC), activity_feed(entity_type, entity_id), client_reports(workspace_id), client_reports(share_token)

### Lead → Email Integration
- [x] ปุ่ม "Enroll in Sequence" จาก Lead list — `lead-list-client.tsx` bulk action + dialog
- [x] Bulk enroll (เลือกหลาย leads → enroll sequence) — เลือก sequence จาก dropdown → confirm → `sequence.enrollLeads`
- [x] Lead status อัพเดทเมื่อมี email activity — Email Activity section ใน `lead-detail-client.tsx`

### Agency Dashboard
- [x] Overview: Leads generated, Emails sent, Open rate, Reply rate — `[workspaceId]/page.tsx` stats cards
- [x] Per-workspace stats — `dashboard.getPerWorkspaceStats` tRPC + agency overview
- [x] Team activity feed — `dashboard.getRecentActivity` tRPC + activity feed UI

### Client Report
- [x] หน้า report per workspace (leads, campaign performance) — `reports/page.tsx` + `report.ts` tRPC
- [x] Shareable link (token-based, ไม่ต้อง login) — `report/[token]/page.tsx` public page + `report.getByToken`
- [x] Export PDF — HTML report generator (Python) + browser print/PDF

### tRPC Routers ใหม่ (Phase 4)
- [x] `src/server/routers/dashboard.ts` — getStats, getRecentActivity, getAgencyOverview, getPerWorkspaceStats
- [x] `src/server/routers/report.ts` — list, getById, create, update, delete, getByToken (public), getData, regenerateToken
- [x] `src/server/routers/activity.ts` — list (cursor-based), create
- [x] `src/server/routers/_app.ts` — เพิ่ม dashboard, report, activity

### Python API ใหม่ (Phase 4)
- [x] `app/services/report_generator.py` — HTML report generator (inline CSS, professional layout)
- [x] `app/services/activity_tracker.py` — Activity tracking service → Supabase
- [x] `app/api/v1/endpoints/report.py` — POST /api/v1/report/generate-html
- [x] `main.py` — เพิ่ม report router

### UI Pages ใหม่ (Phase 4)
- [x] Dashboard page — stats cards + activity feed + quick actions
- [x] Reports page — `[workspaceId]/reports/page.tsx` (list + create + share)
- [x] Public Report — `report/[token]/page.tsx` (shareable, no login)
- [x] Lead-Email integration — enroll in sequence (single + bulk)
- [x] Sidebar — เพิ่ม "รายงาน" nav item

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
Phase 2: Lead Generation      [~] 52/53 tasks  ← เสร็จเกือบหมด เหลือ Supabase Realtime
Phase 3: Email Outreach       [~] 48/49 tasks  ← Email Integration เสร็จ: campaign send, template test send, sequence processing (2026-03-14)
Phase 4: เชื่อม 2 ระบบ        [x] 28/28 tasks ← Phase 4 เสร็จสมบูรณ์ (Frontend UI เสร็จ 2026-03-12)
Phase 5: CRM Layer            [ ] 0/15 tasks
Phase 6: Scale & Optimize     [ ] 0/12 tasks

รวม: 172/190 tasks

### Phase 3 — สิ่งที่ทำใน session นี้ (2026-03-12)
tRPC Routers ใหม่:
- `src/server/routers/campaign.ts` — list, getById, create, update, delete, getContacts, schedule, pause, cancel, previewAudience
- `src/server/routers/template.ts` — list, getById, create, update, delete, duplicate
- `src/server/routers/sequence.ts` — list, getById, create, update, delete, addStep, updateStep, removeStep, enrollLeads, getEnrollments
- `src/server/routers/domain.ts` — list, add, verify, delete, getDnsRecords
- `src/server/routers/_app.ts` — เพิ่ม campaign, template, sequence, domain

UI Pages ใหม่:
- `campaigns/page.tsx` + `campaign-list-client.tsx` — Campaign list + filter + stats
- `campaigns/create/page.tsx` — Create Campaign form + audience preview
- `campaigns/[campaignId]/page.tsx` — Campaign detail + stats cards + contacts table
- `templates/page.tsx` + `template-list-client.tsx` — Template grid + category filter
- `templates/[templateId]/page.tsx` — Split-view HTML editor + live preview
- `sequences/page.tsx` + `sequence-list-client.tsx` — Sequence list + stats
- `sequences/[sequenceId]/page.tsx` — Sequence builder (visual timeline) + enrollments panel
- `settings/domains/page.tsx` — Domain settings + DNS records + verify

Sidebar อัพเดท: เพิ่ม Campaigns (MailOpen), Templates (FileText), Sequences (GitBranch)

### Phase 4 — Database Schema (2026-03-12)
Migration ใหม่: `supabase/migrations/20260312000030_phase4_integration.sql`
- `client_reports` table — shareable report ด้วย share_token + expires_at
- `activity_feed` table — team activity log (append-only, RLS block UPDATE/DELETE)
- `workspace_stats` view — real-time dashboard stats รวมจาก leads/campaigns/email_events (security_invoker)
- `get_report_by_token(token)` function — SECURITY DEFINER สำหรับ public share link
- `cleanup_old_activity_feed(days)` function — retention policy helper

### Phase 4 — Frontend UI (2026-03-12)
ไฟล์ใหม่/อัพเดท:
- `apps/web/src/app/(dashboard)/[workspaceId]/page.tsx` — เขียนใหม่ทั้งหมด: Agency Dashboard พร้อม 6 stats cards (totalLeads, withEmail, campaigns, emailsSent, openRate, clickRate), recent activity feed (icon ตาม action type, relative time), quick actions panel, reports shortcut
- `apps/web/src/app/(dashboard)/[workspaceId]/reports/page.tsx` — Reports page (list + create dialog + date range + share link copy + delete)
- `apps/web/src/app/report/[token]/page.tsx` — Public Report (no login, expired/notfound states, stats + campaign table)
- `apps/web/src/app/(dashboard)/[workspaceId]/leads/lead-list-client.tsx` — เพิ่มปุ่ม "Enroll in Sequence" ใน bulk actions + Enroll dialog
- `apps/web/src/app/(dashboard)/[workspaceId]/leads/[leadId]/lead-detail-client.tsx` — เพิ่ม Email Activity section + ปุ่ม "Enroll in Sequence" เดี่ยว + Enroll dialog
- `apps/web/src/components/sidebar.tsx` — เพิ่ม nav item "รายงาน" (BarChart3 icon)
- `apps/web/src/server/routers/lead.ts` — เพิ่ม `lead.getEmailActivity` endpoint

### Phase 4 — E2E Testing: Leads & Campaigns Pages (2026-03-13)
ไฟล์อัพเดท:
- `apps/web/e2e/leads.spec.ts` — Comprehensive Leads E2E tests: **25 tests**
  - Lead List Page (10 tests): page loads, stat cards, filtering (status, email), sorting (score, name), pagination, export CSV, empty state
  - Lead CRUD (12 tests): search page, create lead, detail page, edit status, add/remove tags, delete
  - Bulk Operations (3 tests): select multiple, bulk delete, export CSV
  - ✅ All tests use existing `test-base.ts` auth fixture
  - ✅ Graceful skip for missing data (data-agnostic design)
  - ✅ Thai language UI support
  - ✅ Playwright best practices (getByRole, getByText, getByLabel)

- `apps/web/e2e/campaigns.spec.ts` — Comprehensive Campaigns E2E tests: **17 tests**
  - Campaign List (5 tests): page loads, table/empty state, filtering by status, create button
  - Campaign CRUD (8 tests): create page, form validation, detail page, stats display, recipients list, audience preview, schedule options
  - Campaign Actions (4 tests): pause campaign, cancel, stats update, empty state
  - ✅ Consistent with Leads tests pattern
  - ✅ Covers all manual test cases
  - ✅ Robust error handling and fallbacks

Key Features:
- **42 total E2E tests** covering happy path + error cases
- Helper functions: `getWorkspaceId()`, `navigateToLeads()`, `navigateToCampaigns()`
- Resilient: `.catch(() => false)` for safe selector checks
- Skip-friendly: `test.skip()` when prerequisites missing
- No hardcoded test data, works with empty or populated database
- 721 lines (leads) + 510 lines (campaigns) = 1,231 total lines

Documentation: See `E2E_TEST_SUMMARY.md` for full details and test execution commands.

### Phase 4 — Testing: tRPC Router Tests (2026-03-13)
ไฟล์ใหม่/อัพเดท:
- `apps/web/src/__tests__/helpers/trpc-test.ts` — Enhanced helpers:
  - `createMockQueryChain()` — mock Supabase fluent API chain (select, eq, maybeSingle, single, etc.)
  - `createMockSupabaseFrom()` — factory สำหรับ mock `supabase.from()` ตาม table name
  - `generateUUID()` — สร้าง valid UUID format สำหรับ test data
  - Existing: `createMockContext()`, `createTestCaller()`, `createUnauthenticatedContext()`

- `apps/web/src/__tests__/routers/lead.test.ts` — อัพเดทจาก soft test เป็น proper assertions:
  - lead.list: filtering (status, hasEmail), sorting (score_desc/asc/name_asc), pagination, score filtering ✓
  - lead.getById: retrieval with lead_scores + lead_tags joins ✓
  - lead.create: validation (email format), duplicate placeId detection ✓
  - lead.createBulk: bulk insert with duplicate skipping ✓
  - lead.update: field updates (status, email, phone, etc.) ✓
  - lead.delete/deleteBulk: role-based access control (agency_admin only) ✓
  - lead.addTag: tagging with duplicate prevention ✓
  - lead.getEmailActivity: email event tracking ✓
  - lead.exportCsv: CSV export with score handling ✓
  - **111 tests passed** | 1 skipped (multi-call mock complexity)

- `apps/web/src/__tests__/routers/campaign.test.ts` — ใหม่ทั้งหมด + proper mocking:
  - campaign.list: filtering by status, pagination, stats aggregation ✓
  - campaign.getById: retrieval with stats ✓
  - campaign.create: creation with template/domain ✓
  - campaign.schedule: status transitions ✓
  - campaign.getContacts: contact listing with pagination ✓
  - campaign.previewAudience: audience count preview ✓
  - campaign.pause/cancel: status management ✓
  - **18 tests passed** ✓

Key improvements:
- Removed try/catch pattern `expect(error).toBeDefined()`
- Replaced with proper `await expect(...).rejects.toThrow()`
- All test data uses `generateUUID()` for valid UUIDs
- Mock Supabase client properly simulates fluent API
- Test fixtures align with actual router logic
- Workspace member checks, role validation, RLS enforcement tested

### Phase 4 — Python API: Report + Activity Tracking (2026-03-12)
ไฟล์ใหม่ใน `apps/python-api/`:
- `app/schemas/report.py` — Pydantic models: ReportGenerateRequest, ReportGenerateResponse, SummaryStats, CampaignStat, TopLead
- `app/services/report_generator.py` — generate_report_html() สร้าง printable HTML report (inline CSS, professional layout, รองรับภาษาไทย via Google Fonts)
- `app/services/activity_tracker.py` — track_activity() core function + convenience wrappers ครบ 14 actions (lead/campaign/email/template/sequence)
- `app/api/v1/endpoints/report.py` — POST /api/v1/report/generate-html endpoint พร้อม date validation
- `main.py` — เพิ่ม report router
- `app/schemas/__init__.py` — export report schemas
- `app/api/v1/endpoints/__init__.py` — register report module
```
