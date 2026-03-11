# Roadmap & Checklist
## AI Lead Generation + Email Outreach System

> ติ๊ก `[x]` เมื่อทำเสร็จ | อ้างอิง [PLAN.md](./PLAN.md) สำหรับรายละเอียด

---

## Phase 0: Project Setup
> เป้าหมาย: โปรเจคพร้อม run ได้บน local

### Repository & Monorepo
- [ ] สร้าง monorepo structure (`apps/web`, `apps/python-api`, `packages/`, `supabase/`, `trigger/`)
- [ ] ตั้งค่า `pnpm workspaces` หรือ `turborepo`
- [ ] สร้าง `.gitignore`, `.env.example`
- [ ] ตั้งค่า ESLint + Prettier (Next.js)
- [ ] ตั้งค่า Python virtual env + `requirements.txt`

### Next.js App
- [ ] `npx create-next-app@latest apps/web --typescript --tailwind --app`
- [ ] ติดตั้ง shadcn/ui
- [ ] ติดตั้ง tRPC (`@trpc/server`, `@trpc/client`, `@trpc/next`)
- [ ] ตั้งค่า folder structure (`app/(auth)`, `app/(dashboard)`)

### Python FastAPI
- [ ] สร้าง `apps/python-api/` พร้อม FastAPI boilerplate
- [ ] ติดตั้ง dependencies: `httpx`, `beautifulsoup4`, `playwright`, `dnspython`, `anthropic`
- [ ] ตั้งค่า CORS สำหรับ Next.js

### Supabase
- [ ] สร้าง Supabase project
- [ ] ติดตั้ง Supabase CLI
- [ ] ตั้งค่า local development (`supabase start`)
- [ ] เพิ่ม environment variables ลง `.env.local`

### Trigger.dev
- [ ] สร้าง Trigger.dev project
- [ ] ติดตั้ง `@trigger.dev/sdk`
- [ ] ตั้งค่า local tunnel (`trigger dev`)

---

## Phase 1: Auth & Multi-tenant
> เป้าหมาย: Login ได้ สร้าง client workspace ได้

### Database Schema
- [ ] Migration: `users` table (เชื่อมกับ Supabase Auth)
- [ ] Migration: `agencies` table
- [ ] Migration: `client_workspaces` table
- [ ] Migration: `workspace_members` table (role: `agency_admin`, `agency_member`, `client_viewer`)
- [ ] Migration: `audit_logs` table
- [ ] ตั้งค่า RLS policies ทุก table (แยก data ตาม `workspace_id`)

### Auth (Supabase Auth)
- [ ] หน้า Sign Up (Email + Password)
- [ ] หน้า Sign In
- [ ] Google OAuth (optional ระยะแรก)
- [ ] Email verification
- [ ] Reset password

### Workspace Management
- [ ] หน้า Dashboard หลัก (เลือก workspace)
- [ ] สร้าง Client Workspace ใหม่
- [ ] Invite team member ผ่านอีเมล
- [ ] จัดการ roles ของสมาชิก
- [ ] Agency Admin เห็นทุก workspace

### Middleware & Guards
- [ ] Route protection (redirect ถ้าไม่ได้ login)
- [ ] Workspace access guard (ห้าม cross-workspace)
- [ ] Role-based UI (ซ่อน/แสดง ตาม role)

---

## Phase 2: Lead Generation
> เป้าหมาย: ค้นหา leads จาก Places API + AI enrichment + scoring

### Database Schema
- [ ] Migration: `leads` table (name, address, phone, website, place_id, workspace_id, status)
- [ ] Migration: `lead_scores` table (score, reasoning, scored_at)
- [ ] Migration: `lead_tags` table
- [ ] Migration: `places_cache` table (cache_key, results JSON, expires_at)
- [ ] RLS policies สำหรับทุก table

### Places API Integration (Python FastAPI)
- [ ] `/api/places/search` endpoint (keyword + lat/lng + radius)
- [ ] Radius bucketing (500 / 1000 / 2000 / 5000m) ก่อน cache
- [ ] Cache check → HIT ส่งผลทันที / MISS → call API → บันทึก cache
- [ ] Cache TTL: list = 7 วัน, details = 30 วัน
- [ ] Handle pagination (Places API ให้ 20 results/call, max 60)
- [ ] Category presets: F&B / SME / อสังหาฯ / B2B
- [ ] Batch search (หลาย keyword พร้อมกัน)

### AI Email Finder (Python FastAPI)
- [ ] `/api/enrichment/find-email` endpoint
- [ ] Step 1: Scrape website ด้วย httpx (homepage + /contact + /about)
- [ ] Step 2: Playwright fallback สำหรับเว็บที่ใช้ JavaScript
- [ ] Step 3: Regex หา email + mailto: links
- [ ] Step 4: Claude extract email จาก page content
- [ ] Step 5: Pattern guess (info@, contact@, hello@, sales@)
- [ ] Step 6: MX Record validation (dnspython)
- [ ] บันทึก confidence score ต่อ email ที่เจอ
- [ ] Rate limiting (ไม่ scrape เว็บเดียวกันซ้ำใน 24 ชั่วโมง)

### Claude Lead Scoring Agent
- [ ] `/api/scoring/score-lead` endpoint
- [ ] Claude วิเคราะห์: rating, reviews count, website, has email, category, location
- [ ] ให้คะแนน 0-100 + เหตุผลสั้น ๆ (ภาษาไทย)
- [ ] บันทึก score + reasoning ลง `lead_scores`
- [ ] Batch scoring (process หลาย leads พร้อมกัน)

### Agent Orchestration
- [ ] Orchestrator Agent รับ search request
- [ ] Lead Finder Agent ค้นหา + cache
- [ ] Enrichment Agents run แบบ parallel (asyncio)
- [ ] Scoring Agent process batch
- [ ] อัพเดทสถานะ lead realtime (Supabase Realtime)

### Lead Management UI (Next.js)
- [ ] หน้าค้นหา leads (search form + map preview)
- [ ] ตารางแสดง leads (sortable, filterable)
- [ ] Lead card: ชื่อ, คะแนน, อีเมล, เบอร์, ที่อยู่, เว็บ, สถานะ
- [ ] Bulk select + assign to workspace
- [ ] Filter: by score, category, has email, status
- [ ] CSV export
- [ ] Duplicate detection UI (แจ้งเตือนถ้า lead ซ้ำ)
- [ ] Lead detail page (timeline, notes)

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
Phase 0: Project Setup        [ ] 0/5  tasks
Phase 1: Auth & Multi-tenant  [ ] 0/14 tasks
Phase 2: Lead Generation      [ ] 0/28 tasks
Phase 3: Email Outreach       [ ] 0/35 tasks
Phase 4: เชื่อม 2 ระบบ        [ ] 0/7  tasks
Phase 5: CRM Layer            [ ] 0/15 tasks
Phase 6: Scale & Optimize     [ ] 0/12 tasks

รวม: 0/116 tasks
```
