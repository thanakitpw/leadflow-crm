# AI Lead Generation Project

## ภาษา
- **ตอบเป็นภาษาไทยทุกครั้ง** ไม่ว่าผู้ใช้จะถามเป็นภาษาอะไรก็ตาม

## Skills
- ใช้ skills ที่ติดตั้งอยู่ใน `.claude/skills/` ในการทำงานเสมอ
- เลือก skill ที่เหมาะสมกับงานแต่ละประเภท เช่น การเขียนโค้ด, การออกแบบ, การทดสอบ ฯลฯ

## Agents
- ใช้ subagents ใน `.claude/agents/` สำหรับงานที่ตรงกับความเชี่ยวชาญของแต่ละ agent
- ให้ delegate งานไปยัง agent ที่เหมาะสมแทนการทำเองทั้งหมด
- Agents ที่มี: `frontend-dev`, `backend-dev`, `db-architect`, `lead-finder`, `enrichment`, `email-writer`, `code-reviewer`, `test-runner`

## แผนโปรเจค
- อ้างอิง [PLAN.md](./PLAN.md) สำหรับ Tech Stack, Architecture, Agent Team และค่าใช้จ่าย
- อ้างอิง [ROADMAP.md](./ROADMAP.md) สำหรับ checklist และความคืบหน้าของงาน
- ทุกการตัดสินใจด้านสถาปัตยกรรมให้ยึด PLAN.md เป็นหลัก
- เมื่อทำ task เสร็จให้อัพเดท ROADMAP.md ด้วยทุกครั้ง

## สิ่งสำคัญที่ต้องจำ
- ระบบแบ่งเป็น 2 ส่วนหลักก่อน: **Lead Generation** และ **Email Outreach** (CRM ทำทีหลัง)
- Database: **Supabase** พร้อม Row Level Security (RLS) ทุก table
- AI Model: **Claude API (claude-sonnet-4-6)** สำหรับ lead scoring และ email writing
- Email: **Resend** ระยะแรก → **AWS SES** เมื่อส่ง > 50,000/เดือน
- Email Finder: **Self-built** (scraping + Claude) ไม่ใช้ Hunter.io
- Places API: ต้องมี **Cache layer** (Supabase table + TTL) ลดค่า API 50-70%
- Architecture: ใช้ **Agent Team** (Orchestrator + Lead Finder + Enrichment + Scorer + Email Writer)

## Environment
- ดู `.env.example` สำหรับตัวแปรทั้งหมดที่ต้องตั้งค่า
- ดู [SETUP.md](./SETUP.md) สำหรับวิธีรันโปรเจคใน local
- **ห้าม commit ไฟล์ `.env`** — ใช้ `.env.example` เป็น template เท่านั้น

## Design System (จาก Paper)

ดีไซน์ทั้งหมดอยู่ในไฟล์ Paper "Lead Flow" — ใช้ Paper MCP อ่านได้
- **Artboards**: 24 boards (19 screens + 1 design system + 4 section labels)
- **Platform**: Desktop 1440×900

### Color Palette

**Brand**
| ชื่อ | Hex | ใช้สำหรับ |
|---|---|---|
| Primary | `#1E3A5F` | ปุ่มหลัก, sidebar, accent |
| Primary Dark | `#152C4A` | hover states, active |
| Primary Light | `#EEF2F8` | backgrounds, badges |
| Ink | `#1C1814` | heading text |
| Muted | `#7A6F68` | secondary text, captions |

**Surface**
| ชื่อ | Hex | ใช้สำหรับ |
|---|---|---|
| White | `#FFFFFF` | card backgrounds |
| Canvas | `#F7F5F2` | page background |
| Subtle | `#EFE9E2` | hover, dividers |
| Border | `#E5DDD6` | borders, separators |

**Semantic**
| ชื่อ | Hex | ใช้สำหรับ |
|---|---|---|
| Success | `#16A34A` | active, sent, positive |
| Warning | `#D97706` | pending, warm leads |
| Danger | `#DC2626` | errors, delete, bounced |
| Info | `#2563EB` | links, info badges |
| AI / Purple | `#7C3AED` | AI features, scoring |

### Typography

**Font**: Noto Sans Thai (primary), Inter, Plus Jakarta Sans
| Style | Weight | Size | Letter Spacing | Line Height |
|---|---|---|---|---|
| Display | 800 | 56px | -0.03em | — |
| Heading 1 | 800 | 36px | -0.02em | — |
| Heading 2 | 700 | 24px | -0.01em | — |
| Heading 3 | 700 | 18px | — | — |
| Body Large | 400 | 16px | — | 1.6 |
| Body | 400 | 14px | — | 1.6 |
| Label / UI | 500 | 13px | — | — |
| Caption / Meta | 400 | 12px | — | — |
| Mono / Code | 400 | 13px | — | — |

### Spacing Rhythm
| Token | Value |
|---|---|
| Icon gap | 8px |
| Element gap | 12–16px |
| Group gap | 24–32px |
| Section gap | 48–72px |
| Page padding | 64px |

### Border Radius
| Token | Value |
|---|---|
| sm | 4px |
| badge | 6px |
| input | 8px |
| btn | 10px |
| card | 12px |
| modal | 16px |
| pill | full |

### Screens (Artboard IDs)
| Screen | Artboard ID | หมวด |
|---|---|---|
| Design System | `1-0` | — |
| Dashboard v2 | `GV-0` | Dashboard |
| Lead Search | `R3-0` | Leads |
| Lead List | `10R-0` | Leads |
| Lead Detail | `10S-0` | Leads |
| Lead Import Export | `10T-0` | Leads |
| Campaign List | `29K-0` | Campaigns |
| Campaign Detail | `1S5-0` | Campaigns |
| Create Campaign | `1S6-0` | Campaigns |
| Email Template List | `2SC-0` | Email |
| Email Template Editor | `2WW-0` | Email |
| Email Sequence List | `30G-0` | Email |
| Sequence Builder | `349-0` | Email |
| Domain Settings | `39G-0` | Settings |
| Settings - Profile | `3DG-0` | Settings |
| Billing | `3HB-0` | Settings |
| Workspace Selection | `3L6-0` | Auth |
| Onboarding | `3MQ-0` | Auth |
| Login | `2G2-0` | Auth |
