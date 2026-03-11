# แผนระบบ AI Lead Generation + Email Outreach
## สำหรับ Marketing Agency (Internal + SaaS)

> อัพเดทล่าสุด: มีนาคม 2026

---

## บริบท

- **ผู้ใช้**: Marketing Agency ทีม 4-10 คน
- **เป้าหมาย 1**: ใช้หาลูกค้าให้ Agency ตัวเอง
- **เป้าหมาย 2**: ขายเป็น SaaS ให้ Agency อื่น
- **กลุ่มเป้าหมาย leads**: F&B, SME, อสังหาริมทรัพย์, B2B/Corporate
- **Database**: Supabase (PostgreSQL + RLS)
- **แนวทาง**: ทำ Lead Gen + Email ก่อน → CRM ทีหลัง

---

## Tech Stack

| Layer | Technology | เหตุผล |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript | SaaS-ready, SSR |
| UI | Tailwind CSS + shadcn/ui | เร็ว สวย |
| Backend | Next.js API Routes + tRPC | Type-safe |
| AI/Enrichment | Python FastAPI (microservice) | Places API + scraping + AI |
| Database | Supabase (PostgreSQL + RLS) | Auth, Realtime, Storage |
| Email (ระยะแรก) | Resend + React Email | ง่าย developer-friendly |
| Email (ระยะหลัง) | AWS SES | ถูกกว่า 89% เมื่อ scale |
| Background Jobs | Trigger.dev | Email sequences, scheduled tasks |
| Cache | Supabase table (TTL) | Cache Places API results |
| AI Model | Claude API (claude-sonnet-4-6) | Lead scoring, email writing |

---

## Architecture Overview

```
Next.js App (SaaS)
    │
    ├── Lead Generation UI
    ├── Email Outreach UI
    └── tRPC API Layer
            │
    ┌───────┼────────────┐
    │       │            │
Supabase  Python API  Trigger.dev
(Main DB) (AI/Places)  (Email Jobs)
    │       │            │
    │   Google Places  Resend / AWS SES
    │   + Web Scraper
    │   + Claude API
    │
 PostgreSQL + RLS
```

---

## Multi-tenant Model (Agency + Clients)

```
Agency Admin (Super Admin)
    │
    ├── Agency Workspace (ใช้เอง)
    │       ├── Leads
    │       └── Email Campaigns
    │
    ├── Client Workspace: "ร้านอาหาร A"
    │       ├── Leads (Agency หาให้)
    │       ├── Campaigns
    │       └── Reports (client ดูได้)
    │
    └── Client Workspace: "บริษัท B"
```

**Role ในระบบ:**
- `agency_admin` — จัดการทุกอย่าง
- `agency_member` — ทำงานใน workspace ที่ได้รับมอบหมาย
- `client_viewer` — ดูรายงานได้อย่างเดียว

---

## Modules และลำดับ Implement

### Phase 1: Lead Generation (สัปดาห์ 1-2)

**Flow:**
```
Search Places API → Scrape Website → AI Email Finder → Claude Scoring → Review → Assign to Client
```

**Features:**
- ค้นหาธุรกิจตาม keyword + location + radius
- Category presets: F&B / SME / อสังหาฯ / B2B
- AI Email Finder (แทน Hunter.io — ดูหัวข้อด้านล่าง)
- Claude lead scoring 0-100 พร้อมเหตุผล
- Bulk import + deduplication
- Assign leads → client workspace
- CSV export

**Supabase Tables:**
```
leads, lead_sources, lead_scores, lead_tags, lead_assignments, places_cache
```

---

### Phase 2: Email Outreach (สัปดาห์ 3-4)

**Features:**
- Email Templates (React Email + variables เช่น `{{business_name}}`)
- Campaigns (one-time blast)
- Sequences (drip — multi-step, auto-stop เมื่อ reply)
- Open/Click tracking
- Bounce & Unsubscribe management
- Custom domain (SPF/DKIM/DMARC) per client
- Email warm-up scheduler
- Daily sending limit (ป้องกัน spam)

**Background Jobs (Trigger.dev):**
```
send-campaign → process-sequence-step → handle-email-webhook → daily-warmup
```

**Supabase Tables:**
```
email_templates, campaigns, campaign_contacts, sequences,
sequence_steps, sequence_enrollments, email_events, unsubscribes, sending_domains
```

---

### Phase 3: เชื่อม 2 ระบบ (เดือน 2)

- Lead → assign → enroll in email sequence ได้เลย
- Agency dashboard: overview ทุก workspace
- Client report (shareable link / PDF)

---

### Phase 4: CRM Layer (เดือน 3+)

- Contact & Company management
- Pipeline & Deals (Kanban)
- Activity timeline
- Automation / Workflow

---

## AI Email Finder (แทน Hunter.io)

ประหยัด $49-299/เดือน โดยสร้างเอง

**Flow:**
```
Website URL (จาก Places API)
    │
    ├── Step 1: Scrape homepage + /contact + /about
    ├── Step 2: Regex หา email + mailto: links
    ├── Step 3: Claude extract จาก page content
    ├── Step 4: Pattern guess (info@, contact@, hello@)
    └── Step 5: MX Record validation
```

**Confidence Score:**
| วิธี | Score |
|---|---|
| mailto: link | 95% |
| Regex จาก HTML | 80% |
| Claude extract | 75% |
| Pattern guess | 50% |
| ไม่เจอ | 0% |

**Tech:** Python + httpx + BeautifulSoup + dnspython + Claude API

**ข้อจำกัด:**
- เว็บที่ใช้ JS → ใช้ Playwright (fallback)
- SME ไทยบางเจ้าไม่มีเว็บ → หาจาก Facebook Page แทน
- Pattern email มี bounce rate สูง → warm-up domain ให้ดี

---

## Email Service: Resend → AWS SES

**เมื่อไหรควร switch:** ส่งอีเมล > 50,000/เดือน หรือ client > 10 ราย

**แบ่งหน้าที่:**
```
Resend  → Transactional (OTP, reset password, notification)
AWS SES → Bulk campaigns + sequences
```

**ขั้นตอน switch:**
1. สร้าง Email Service Layer (abstract — สลับ provider ได้ไม่ต้องแก้โค้ดอื่น)
2. Verify domain บน SES (SPF/DKIM/DMARC)
3. ขอ SES production access (1-2 วัน)
4. Warm-up dedicated IP (2-4 สัปดาห์)
5. Handle bounce/complaint ผ่าน SNS → Webhook → Supabase

**ประหยัด:** Resend $90/mo vs SES $10/mo (100k emails) = **ประหยัด 89%**

---

## Cache Places API Results

ลดค่า API ได้ 50-70%

**Strategy:**
```
Search Request
    → เช็ค Cache (Supabase)
    → HIT: ส่งผลทันที (ฟรี)
    → MISS: Call Places API → บันทึก Cache → ส่งผล
```

**Cache Table:**
```
places_cache
├── cache_key   (hash ของ keyword + lat + lng + radius_bucket)
├── results     (JSON)
├── cached_at
└── expires_at
```

**TTL:**
- ผลการค้นหา (list): 7 วัน
- Place Details: 30 วัน

**Radius Bucketing:** ปัด radius เป็น 500 / 1000 / 2000 / 5000m ก่อน hash

**ประมาณการประหยัด:**
| สถานการณ์ | ไม่มี Cache | มี Cache | ประหยัด |
|---|---|---|---|
| Search location เดิมซ้ำ | 10,000 calls | ~2,000 calls | 80% |
| Agency ทดสอบหลายรอบ | 50,000 calls | ~5,000 calls | 90% |

---

## Agent Team Architecture

ระบบนี้ **ควรใช้ Agent Team** เพราะงานแต่ละส่วนทำพร้อมกันได้และเป็นอิสระต่อกัน

**Agents ที่ควรมี:**

```
Orchestrator Agent
    │
    ├── Lead Finder Agent
    │       └── ค้นหา Places API + cache check
    │
    ├── Enrichment Agent (parallel)
    │       ├── Web Scraper Sub-agent
    │       ├── Email Finder Sub-agent
    │       └── Social Media Sub-agent (Facebook Page)
    │
    ├── Scoring Agent
    │       └── Claude วิเคราะห์ lead + ให้คะแนน + เหตุผล
    │
    ├── Email Writer Agent
    │       └── Claude เขียนอีเมล personalized ตาม lead profile
    │
    └── Campaign Manager Agent
            ├── จัดการ sequence timing
            ├── ตรวจสอบ reply → stop sequence
            └── report ผล
```

**ทำไม Agent Team ดีกว่า Sequential:**
- Enrichment 100 leads พร้อมกัน (parallel) แทนที่จะทำทีละตัว
- Lead Finder ทำงานต่อได้ขณะ Scoring Agent กำลัง process batch ก่อน
- แต่ละ Agent มี context เฉพาะ → ใช้ token น้อยกว่า monolithic prompt
- Scale ง่าย: เพิ่ม Enrichment Agent เมื่อ load สูง

**Tool ที่แนะนำ:** Trigger.dev (orchestration) + Claude API (AI agents)

---

## ประมาณการค่าใช้จ่าย

### Internal Agency Use (~500 leads, 5,000 emails/เดือน)
| รายการ | ค่าใช้จ่าย |
|---|---|
| Google Places API | ฟรี (free tier) |
| AI Email Finder | ~$4 (Claude API) |
| Claude Lead Scoring | ~$4 |
| Resend | $20 |
| Supabase | ฟรี |
| Trigger.dev | ฟรี |
| **รวม** | **~$28/เดือน (~1,000 บาท)** |

### SaaS Growth Stage (50 clients)
| รายการ | ก่อน Optimize | หลัง Optimize |
|---|---|---|
| Places API | $100 | $30 (cache) |
| Email Finder (self-built) | $35 | $35 |
| Claude API | $150 | $150 |
| Email (Resend→SES) | $90 | $10 |
| Supabase Pro | $25 | $25 |
| Trigger.dev | $50 | $50 |
| **รวม** | **$450** | **$300/เดือน** |

### SaaS Pricing แนะนำ
| Plan | ราคา | Leads/mo | Emails/mo |
|---|---|---|---|
| Free | $0 | 50 | 500 |
| Starter | $49 | 500 | 5,000 |
| Pro | $99 | 2,000 | 20,000 |
| Agency | $199 | 10,000 | 100,000 |

**Gross Margin ที่ 50 clients:** ~$4,950 revenue / $300 cost = **94% margin**

---

## File Structure

```
ai-lead-generation/
├── apps/
│   ├── web/                      # Next.js frontend
│   │   └── app/
│   │       ├── (auth)/
│   │       └── (dashboard)/
│   │           ├── workspaces/
│   │           ├── leads/
│   │           ├── emails/
│   │           ├── reports/
│   │           └── settings/
│   │
│   └── python-api/               # FastAPI — AI + Places + Scraping
│       ├── agents/
│       │   ├── orchestrator.py
│       │   ├── lead_finder.py
│       │   ├── enrichment.py
│       │   ├── email_finder.py
│       │   ├── scorer.py
│       │   └── email_writer.py
│       └── services/
│           ├── places.py
│           ├── scraper.py
│           ├── cache.py
│           └── mx_validator.py
│
├── packages/
│   ├── database/                 # Supabase migrations + schema
│   ├── email-templates/          # React Email templates
│   └── types/                    # Shared TypeScript types
│
├── supabase/
│   ├── migrations/
│   └── seed.sql
│
└── trigger/                      # Background jobs
    ├── send-campaign.ts
    ├── process-sequence.ts
    ├── handle-email-webhook.ts
    └── daily-warmup.ts
```

---

## Roadmap สรุป

```
สัปดาห์ 1-2   Lead Generation + AI Email Finder + Claude Scoring
สัปดาห์ 3-4   Email Outreach + Sequences + Tracking
เดือน 2        เชื่อม 2 ระบบ + Agency Dashboard + Client Reports
เดือน 3+       CRM (Contacts, Pipeline, Deals, Automation)
เมื่อ > 50k    Switch Email → AWS SES
เมื่อ > 10k    Places API cache เต็มรูปแบบ
```
