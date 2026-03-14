# LeadFlow CRM — Manual Testing Guide

> คู่มือทดสอบด้วยมือสำหรับ QA / Developer ก่อน deploy production
> อัพเดทล่าสุด: 2026-03-13

---

## สารบัญ

1. [เตรียมตัวก่อนเทส](#1-เตรียมตัวก่อนเทส)
2. [Auth & Onboarding](#2-auth--onboarding)
3. [Profile](#3-profile)
4. [Workspace & Members](#4-workspace--members)
5. [Leads](#5-leads)
6. [Campaigns](#6-campaigns)
7. [Email Templates](#7-email-templates)
8. [Sequences](#8-sequences)
9. [Domain Settings](#9-domain-settings)
10. [Dashboard](#10-dashboard)
11. [Reports](#11-reports)
12. [Email Tracking](#12-email-tracking)
13. [Security & Permission](#13-security--permission)
14. [Cross-feature Flows](#14-cross-feature-flows)
15. [Edge Cases & Error Handling](#15-edge-cases--error-handling)

---

## 1. เตรียมตัวก่อนเทส

### 1.1 Environment Setup

```bash
# 1. Clone และ install
git clone <repo-url>
cd ai-lead-generation
npm install

# 2. Copy environment
cp .env.example apps/web/.env.local

# 3. ตั้งค่า .env.local
NEXT_PUBLIC_SUPABASE_URL=<supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
RESEND_API_KEY=<resend-key>  # optional สำหรับ email testing

# 4. รัน dev server
cd apps/web && npm run dev
# เปิด http://localhost:3000
```

### 1.2 Test Accounts ที่ควรเตรียม

| Account | Email | Role | ใช้ทดสอบ |
|---------|-------|------|----------|
| Admin | admin@test.com | agency_admin | สิทธิ์เต็ม |
| Member | member@test.com | agency_member | สิทธิ์จำกัด |
| Viewer | viewer@test.com | client_viewer | ดูอย่างเดียว |
| ไม่มีสิทธิ์ | outsider@test.com | ไม่ใช่ member | ทดสอบ RLS |

### 1.3 Browser & Tools

- Chrome DevTools → Network tab (ดู API calls)
- Supabase Dashboard → ดู database rows
- Resend Dashboard → ดู email logs (ถ้าเชื่อม)

---

## 2. Auth & Onboarding

### 2.1 สมัครสมาชิก (Sign Up)

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 2.1.1 | สมัครสำเร็จ | ใส่ email + password (8+ ตัว) → กด Sign Up | redirect ไปหน้า onboarding หรือ email confirmation | ✅ |
| 2.1.2 | Email ซ้ำ | ใส่ email ที่สมัครแล้ว → กด Sign Up | แสดง error "Email นี้ถูกใช้แล้ว" | ✅ | ข้อนี้ถ้าอีเมลซ้ำกัน มันจะเด้งไปให้ล็อกอินใช่ไหม
| 2.1.3 | Password สั้น | ใส่ password < 8 ตัว → กด Sign Up | แสดง validation error | ✅ |
| 2.1.4 | Email ไม่ถูกรูปแบบ | ใส่ "not-an-email" → กด Sign Up | แสดง validation error | ✅ |
| 2.1.5 | ช่องว่าง | ไม่ใส่ email หรือ password → กด Sign Up | ปุ่ม disabled หรือ error | ✅ |

### 2.2 เข้าสู่ระบบ (Login)

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 2.2.1 | Login สำเร็จ | ใส่ email + password ที่ถูกต้อง | redirect ไป dashboard หรือ workspace selection | ✅ |
| 2.2.2 | Password ผิด | ใส่ email ถูก + password ผิด | แสดง error "Invalid credentials" | ✅ |
| 2.2.3 | Email ไม่มีในระบบ | ใส่ email ที่ยังไม่สมัคร | แสดง error | ✅ |
| 2.2.4 | Session persist | Login → ปิด tab → เปิดใหม่ | ยังอยู่ในระบบ (ไม่ต้อง login ใหม่) | ✅ |

### 2.3 Onboarding (สร้าง Agency)

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 2.3.1 | สร้าง Agency สำเร็จ | ใส่ชื่อ "My Agency" + slug "my-agency" | สร้าง agency + default workspace → redirect ไป dashboard | ✅ |
| 2.3.2 | Slug ซ้ำ | ใส่ slug ที่มีคนใช้แล้ว | error "Slug ถูกใช้แล้ว" | ✅ | ตอนนี้แก้เป็นเพิ่มตัวเลขให้ uniqueแล้ว
| 2.3.3 | Slug ไม่ถูกรูปแบบ | ใส่ slug มี space หรือ uppercase | error หรือ auto-format เป็น lowercase | ✅ |
| 2.3.4 | Slug สั้นเกิน | ใส่ slug < 3 ตัวอักษร | validation error | ✅ |

### 2.4 Logout

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 2.4.1 | Logout สำเร็จ | กดปุ่ม Logout | redirect ไป /login, session ถูกล้าง | ✅ |
| 2.4.2 | หลัง logout เข้าถึง dashboard | Logout → พิมพ์ URL dashboard ตรงๆ | redirect กลับ /login | ✅ |

---

## 3. Profile

### 3.1 ดูโปรไฟล์

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 3.1.1 | ดูโปรไฟล์ตัวเอง | ไปหน้า Settings > Profile | แสดง email, ชื่อ, avatar | ✅ |

### 3.2 แก้ไขโปรไฟล์

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 3.2.1 | แก้ชื่อ | เปลี่ยน full_name → กด Save | ชื่อเปลี่ยนสำเร็จ, แสดงชื่อใหม่ | ✅ |
| 3.2.2 | ชื่อว่าง | ลบชื่อให้ว่าง → กด Save | validation error | Best Solutions |

---

## 4. Workspace & Members

### 4.1 Workspace

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 4.1.1 | ดู workspace list | ไปหน้า workspace selection | แสดง workspace ทั้งหมดที่เป็น member | ✅ |
| 4.1.2 | สร้าง workspace ใหม่ | กด "สร้าง Workspace" → ใส่ชื่อ + type | สร้างสำเร็จ, แสดงใน list | ✅ |
| 4.1.3 | เข้า workspace | กดเลือก workspace | เข้า dashboard ของ workspace นั้น | ✅ |
| 4.1.4 | แก้ชื่อ workspace | Settings > Workspace → แก้ชื่อ | ชื่อเปลี่ยน, sidebar แสดงชื่อใหม่ | ✅ |
| 4.1.5 | ลบ workspace (client type) | Settings > ลบ workspace ที่เป็น type "client" | ลบสำเร็จ | ✅ |
| 4.1.6 | ลบ default workspace | พยายามลบ workspace แรก (type: agency) | error "ไม่สามารถลบ default workspace" | ✅ |

### 4.2 Members

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 4.2.1 | ดู members | Settings > Members | แสดงรายชื่อ + role ทั้งหมด | ✅ |
| 4.2.2 | เชิญ member ใหม่ | กด "เชิญ" → ใส่ email → เลือก role | เพิ่ม member (pending ถ้ายังไม่มี account) | ☐ |
| 4.2.3 | เชิญ email ซ้ำ | เชิญ email ที่เชิญไปแล้ว | error "ได้รับเชิญแล้ว" | ☐ |
| 4.2.4 | เปลี่ยน role | Admin เปลี่ยน role ของ member | role เปลี่ยนสำเร็จ | ☐ |
| 4.2.5 | เปลี่ยน role ตัวเอง | Admin พยายามเปลี่ยน role ของตัวเอง | error "ไม่สามารถเปลี่ยน role ตัวเอง" | ☐ |
| 4.2.6 | ลบ member | Admin ลบ member ออก | member หายไปจาก list | ☐ |
| 4.2.7 | ลบตัวเอง | Admin พยายามลบตัวเอง | error "ไม่สามารถลบตัวเอง" | ☐ |
| 4.2.8 | Non-admin เชิญ | Login ด้วย member role → พยายามเชิญ | error "FORBIDDEN" หรือไม่เห็นปุ่ม | ☐ |

---

## 5. Leads

### 5.1 Lead List

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 5.1.1 | ดูรายการ leads | ไปหน้า Leads | แสดง leads table พร้อม pagination | ☐ |
| 5.1.2 | Filter by status | เลือก filter "New" | แสดงเฉพาะ status = new | ☐ |
| 5.1.3 | Filter by "มี email" | เลือก filter "มี email" | แสดงเฉพาะที่มี email | ☐ |
| 5.1.4 | Filter by "ไม่มี email" | เลือก filter "ไม่มี email" | แสดงเฉพาะที่ไม่มี email | ☐ |
| 5.1.5 | Sort by score สูงสุด | เลือก sort "คะแนนสูงสุด" | เรียง lead ที่ score สูงก่อน | ☐ |
| 5.1.6 | Sort by ชื่อ | เลือก sort "ชื่อ A-Z" | เรียงตามชื่อ | ☐ |
| 5.1.7 | Pagination | มี leads > 20 → กดหน้าถัดไป | แสดง leads ชุดถัดไป | ☐ |
| 5.1.8 | ไม่มี leads | Workspace ใหม่ไม่มี leads | แสดง empty state | ☐ |

### 5.2 สร้าง Lead

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 5.2.1 | สร้าง lead ด้วยชื่อเท่านั้น | กด "เพิ่ม Lead" → ใส่ชื่อ → Save | สร้างสำเร็จ, status = "new" | ☐ |
| 5.2.2 | สร้าง lead ข้อมูลครบ | ใส่ชื่อ + email + phone + website + address | สร้างสำเร็จ, ข้อมูลครบ | ☐ |
| 5.2.3 | Email ไม่ถูกรูปแบบ | ใส่ email = "not-valid" | validation error | ☐ |
| 5.2.4 | Lead ซ้ำ (place_id) | สร้าง lead ที่มี place_id ซ้ำกับที่มีอยู่ | error "Lead มีอยู่แล้ว" | ☐ |
| 5.2.5 | ชื่อว่าง | ไม่ใส่ชื่อ → Save | validation error | ☐ |

### 5.3 Lead Detail

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 5.3.1 | ดูรายละเอียด lead | คลิกที่ lead ใน list | แสดงข้อมูลครบ: ชื่อ, email, score, tags | ☐ |
| 5.3.2 | ดู score history | ดูส่วน "ประวัติคะแนน" | แสดง scores ทั้งหมดพร้อม reasoning | ☐ |
| 5.3.3 | ดู tags | ดูส่วน tags | แสดง tags ทั้งหมด | ☐ |
| 5.3.4 | ดู email activity | ดูส่วน "Email Activity" | แสดง events (sent, opened, clicked) | ☐ |

### 5.4 แก้ไข Lead

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 5.4.1 | แก้ status | เปลี่ยน status เป็น "Contacted" | status เปลี่ยน, แสดง badge ใหม่ | ☐ |
| 5.4.2 | เพิ่ม email | Lead ไม่มี email → ใส่ email → Save | email บันทึกสำเร็จ | ☐ |
| 5.4.3 | เพิ่ม notes | ใส่ notes → Save | notes บันทึกสำเร็จ | ☐ |

### 5.5 Tags

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 5.5.1 | เพิ่ม tag | พิมพ์ tag ใหม่ → กด Enter/Add | tag แสดงบน lead | ☐ |
| 5.5.2 | Tag ซ้ำ | เพิ่ม tag ชื่อเดิม | error "Tag มีอยู่แล้ว" | ☐ |
| 5.5.3 | ลบ tag | กด X บน tag | tag หายไป | ☐ |
| 5.5.4 | Tag ยาวเกิน | ใส่ tag > 50 ตัวอักษร | validation error | ☐ |

### 5.6 ลบ Lead

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 5.6.1 | ลบ lead เดียว | กด Delete → Confirm | lead หายจาก list | ☐ |
| 5.6.2 | ลบหลาย leads | เลือก checkbox หลายตัว → กด Delete | ลบทั้งหมดที่เลือก | ☐ |
| 5.6.3 | ยกเลิกการลบ | กด Delete → กด Cancel | lead ยังอยู่ | ☐ |

### 5.7 Export CSV

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 5.7.1 | Export ทั้งหมด | กดปุ่ม Export CSV | ดาวน์โหลดไฟล์ .csv ที่มี leads ทั้งหมด | ☐ |
| 5.7.2 | ตรวจข้อมูลใน CSV | เปิดไฟล์ CSV | มีคอลัมน์: ชื่อ, อีเมล, เบอร์, เว็บ, สถานะ, คะแนน, rating | ☐ |
| 5.7.3 | Export ไม่มี leads | Workspace ว่าง → Export | ได้ไฟล์ที่มี header เท่านั้น | ☐ |

---

## 6. Campaigns

### 6.1 Campaign List

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 6.1.1 | ดูรายการ campaigns | ไปหน้า Campaigns | แสดง campaigns + stats (sent, opened %) | ☐ |
| 6.1.2 | Filter by status | เลือก filter "Draft" | แสดงเฉพาะ draft campaigns | ☐ |
| 6.1.3 | ไม่มี campaigns | Workspace ใหม่ | แสดง empty state + ปุ่ม "สร้าง Campaign" | ☐ |

### 6.2 สร้าง Campaign

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 6.2.1 | สร้างด้วยชื่อเท่านั้น | ใส่ชื่อ "Test Campaign" → Save | สร้างสำเร็จ, status = "draft" | ☐ |
| 6.2.2 | สร้างพร้อม template | เลือก template → Save | campaign เชื่อมกับ template | ☐ |
| 6.2.3 | สร้างพร้อม audience filter | ตั้ง filter (score >= 60, status: qualified) → Save | filter บันทึก, preview audience count ถูกต้อง | ☐ |
| 6.2.4 | ชื่อว่าง | ไม่ใส่ชื่อ → Save | validation error | ☐ |

### 6.3 Campaign Detail

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 6.3.1 | ดู campaign detail | คลิก campaign จาก list | แสดงข้อมูลครบ: ชื่อ, status, template, stats | ☐ |
| 6.3.2 | ดู recipients | ดูส่วน Contacts/Recipients | แสดงรายชื่อ lead + สถานะส่ง (sent, opened, clicked) | ☐ |
| 6.3.3 | ดู stats | ดูส่วน Stats | แสดง sent, opened, clicked, bounced + % | ☐ |

### 6.4 Campaign Actions

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 6.4.1 | Schedule campaign | กด "ตั้งเวลาส่ง" → เลือกวัน/เวลาในอนาคต | status → "scheduled", แสดงเวลาที่ตั้ง | ☐ |
| 6.4.2 | Schedule วันที่ผ่านไปแล้ว | เลือกวันในอดีต | error หรือ validation | ☐ |
| 6.4.3 | Pause campaign | Campaign กำลังส่ง → กด "หยุดชั่วคราว" | status → "paused" | ☐ |
| 6.4.4 | Cancel campaign | กด "ยกเลิก Campaign" | status → "cancelled" | ☐ |
| 6.4.5 | Preview audience | กด "Preview Audience" | แสดงจำนวน leads ที่จะได้รับ email | ☐ |

---

## 7. Email Templates

### 7.1 Template List

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 7.1.1 | ดูรายการ templates | ไปหน้า Templates | แสดง template cards + category | ☐ |
| 7.1.2 | Filter by category | เลือก category | แสดงเฉพาะ category นั้น | ☐ |
| 7.1.3 | ไม่มี templates | Workspace ใหม่ | แสดง empty state | ☐ |

### 7.2 สร้าง/แก้ไข Template

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 7.2.1 | สร้าง template ใหม่ | ใส่ชื่อ + subject + body HTML → Save | สร้างสำเร็จ | ☐ |
| 7.2.2 | ใส่ตัวแปร | พิมพ์ `{{lead_name}}` ใน body | แสดงตัวแปรใน preview | ☐ |
| 7.2.3 | Preview template | กด Preview | แสดง rendered HTML | ☐ |
| 7.2.4 | แก้ไข template | เปิด template → แก้ subject → Save | subject เปลี่ยน | ☐ |
| 7.2.5 | ชื่อว่าง | ลบชื่อ → Save | validation error | ☐ |

### 7.3 Template Actions

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 7.3.1 | Duplicate template | กด "Duplicate" | สร้างสำเนา ชื่อ "{ชื่อเดิม} (สำเนา)" | ☐ |
| 7.3.2 | ลบ template | กด Delete → Confirm | template หายจาก list | ☐ |
| 7.3.3 | ลบ template ที่ใช้ใน campaign | Template ที่เชื่อมกับ campaign → Delete | แสดง warning แต่ยังลบได้ | ☐ |

### 7.4 Template Variables

ตรวจสอบว่า variables เหล่านี้ทำงานถูกต้อง:

| Variable | ค่าตัวอย่าง | Pass? |
|----------|------------|-------|
| `{{lead_name}}` | "บริษัท ABC" | ☐ |
| `{{lead_email}}` | "abc@test.com" | ☐ |
| `{{lead_phone}}` | "02-123-4567" | ☐ |
| `{{lead_website}}` | "https://abc.com" | ☐ |
| `{{lead_address}}` | "123 ถ.สุขุมวิท" | ☐ |
| `{{lead_category}}` | "Restaurant" | ☐ |
| `{{lead_rating}}` | "4.5" | ☐ |
| `{{lead_score}}` | "85" | ☐ |
| `{{sender_name}}` | "John Doe" | ☐ |
| `{{sender_email}}` | "john@agency.com" | ☐ |
| `{{company_name}}` | "My Agency" | ☐ |
| `{{unsubscribe_link}}` | URL ที่ถูกต้อง | ☐ |
| Variable ไม่มีค่า | `{{lead_phone}}` แต่ไม่มี phone | แสดงเป็นค่าว่าง ไม่ใช่ "{{lead_phone}}" | ☐ |

---

## 8. Sequences

### 8.1 Sequence List

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 8.1.1 | ดูรายการ sequences | ไปหน้า Sequences | แสดง sequence + จำนวน steps + active enrollments | ☐ |
| 8.1.2 | ไม่มี sequences | Workspace ใหม่ | แสดง empty state | ☐ |

### 8.2 สร้าง/แก้ไข Sequence

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 8.2.1 | สร้าง sequence | ใส่ชื่อ → Save | สร้างสำเร็จ, status = "draft" | ☐ |
| 8.2.2 | เพิ่ม step | เลือก template + ตั้ง delay (เช่น 1 วัน) → Add | step เพิ่มใน sequence | ☐ |
| 8.2.3 | เพิ่มหลาย steps | เพิ่ม 3-4 steps | steps เรียงตาม order ถูกต้อง | ☐ |
| 8.2.4 | แก้ไข step | เปลี่ยน delay → Save | delay เปลี่ยน | ☐ |
| 8.2.5 | ลบ step | กด Delete step | step หายไป, order อัพเดต | ☐ |
| 8.2.6 | ลบ sequence | กด Delete sequence | sequence + steps ทั้งหมดหายไป | ☐ |

### 8.3 Enrollment

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 8.3.1 | Enroll leads จาก lead list | เลือก leads → กด "Enroll in Sequence" → เลือก sequence | enrolled สำเร็จ, แสดงจำนวน enrolled/skipped | ☐ |
| 8.3.2 | Enroll จาก lead detail | เปิด lead → กด "Enroll" → เลือก sequence | enrolled สำเร็จ | ☐ |
| 8.3.3 | Enroll lead ที่ enrolled แล้ว | Enroll lead ที่อยู่ใน sequence เดิม | skip (ไม่ duplicate) | ☐ |
| 8.3.4 | ดู enrollments | ไป sequence detail → ดู Enrollments tab | แสดง enrolled leads + status + current step | ☐ |

### 8.4 Sequence Status

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 8.4.1 | Activate sequence | Draft sequence → กด "Activate" | status → "active" | ☐ |
| 8.4.2 | Pause sequence | Active sequence → กด "Pause" | status → "paused" | ☐ |
| 8.4.3 | Archive sequence | กด "Archive" | status → "archived" | ☐ |

---

## 9. Domain Settings

### 9.1 Domain List

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 9.1.1 | ดู domains | ไป Settings > Domain | แสดง domains + status (verified/pending) | ☐ |
| 9.1.2 | ไม่มี domain | ยังไม่เพิ่ม domain | แสดง empty state + คำแนะนำ | ☐ |

### 9.2 เพิ่ม Domain

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 9.2.1 | เพิ่ม domain | กด "เพิ่ม Domain" → ใส่ "mail.example.com" | สร้างสำเร็จ, status = "pending", แสดง DNS records | ☐ |
| 9.2.2 | Domain ไม่ถูกรูปแบบ | ใส่ "not a domain" | validation error | ☐ |
| 9.2.3 | Domain ซ้ำ | ใส่ domain ที่เพิ่มไปแล้ว | error "Domain มีอยู่แล้ว" | ☐ |

### 9.3 DNS Records & Verification

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 9.3.1 | ดู DNS records | คลิก domain → ดู DNS tab | แสดง DKIM, SPF, DMARC records ที่ต้องตั้งค่า | ☐ |
| 9.3.2 | Verify domain | ตั้ง DNS records → กด "Verify" | ตรวจสอบ records, อัพเดตสถานะ | ☐ |
| 9.3.3 | Verify ไม่ผ่าน | DNS ยังไม่ setup → กด "Verify" | แสดงว่า record ไหนยังไม่ผ่าน | ☐ |

### 9.4 ลบ Domain

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 9.4.1 | ลบ domain | กด Delete → Confirm | domain หายจาก list | ☐ |

---

## 10. Dashboard

### 10.1 Stats Overview

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 10.1.1 | ดู lead stats | Dashboard → ส่วน Lead Stats | แสดง total, มี email, ไม่มี email, coverage % | ☐ |
| 10.1.2 | ดู campaign stats | Dashboard → ส่วน Campaign Stats | แสดง total, active, completed | ☐ |
| 10.1.3 | ดู email stats | Dashboard → ส่วน Email Stats | แสดง sent, opened, clicked, bounced + % rates | ☐ |
| 10.1.4 | Dashboard ว่าง | Workspace ใหม่ไม่มีข้อมูล | ทุก stats = 0, แสดง empty state สวยงาม | ☐ |

### 10.2 Activity Feed

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 10.2.1 | ดู activity ล่าสุด | Dashboard → ส่วน Recent Activity | แสดง actions ล่าสุด (สร้าง lead, ส่ง campaign) | ☐ |
| 10.2.2 | ไม่มี activity | Workspace ใหม่ | แสดง "ยังไม่มีกิจกรรม" | ☐ |

### 10.3 Quick Actions

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 10.3.1 | Quick action: ค้นหาลีด | กด "ค้นหาลีดใหม่" | navigate ไปหน้า Lead Search | ☐ |
| 10.3.2 | Quick action: สร้าง campaign | กด "สร้าง Campaign" | navigate ไปหน้า Create Campaign | ☐ |

---

## 11. Reports

### 11.1 Report List

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 11.1.1 | ดูรายการ reports | ไปหน้า Reports | แสดง report cards + date range | ☐ |
| 11.1.2 | ไม่มี reports | Workspace ใหม่ | แสดง empty state | ☐ |

### 11.2 สร้าง Report

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 11.2.1 | สร้าง report | กด "สร้าง Report" → ใส่ title + date range → Save | สร้างสำเร็จ | ☐ |
| 11.2.2 | date_from > date_to | ตั้ง date_from หลัง date_to | validation error | ☐ |
| 11.2.3 | ดู report data | เปิด report → ดูข้อมูล | แสดง leads, emails, top campaigns ตาม date range | ☐ |

### 11.3 แชร์ Report

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 11.3.1 | สร้าง share link | กด "แชร์" → Copy link | ได้ URL ที่มี token | ☐ |
| 11.3.2 | เปิด share link (ไม่ login) | เปิด link ใน incognito | แสดง report data (ไม่ต้อง login) | ☐ |
| 11.3.3 | Share link หมดอายุ | ตั้ง expires 1 วัน → รอหมดอายุ → เปิด link | error "Report หมดอายุ" | ☐ |
| 11.3.4 | Regenerate token | กด "สร้าง Link ใหม่" | token เปลี่ยน, link เก่าใช้ไม่ได้ | ☐ |
| 11.3.5 | Revoke sharing | กด "ยกเลิกการแชร์" | share link ใช้ไม่ได้อีก | ☐ |

### 11.4 ลบ Report

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 11.4.1 | ลบ report (admin) | Admin กด Delete → Confirm | ลบสำเร็จ | ☐ |
| 11.4.2 | ลบ report (member) | Member พยายามลบ | error "FORBIDDEN" หรือไม่เห็นปุ่ม | ☐ |

---

## 12. Email Tracking

### 12.1 Open Tracking (Pixel)

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 12.1.1 | Pixel response | เปิด URL `/api/track/open/<eventId>` ใน browser | ได้รับ 1x1 transparent GIF | ☐ |
| 12.1.2 | ตรวจ headers | ดู response headers | Content-Type: image/gif, Cache-Control: no-store | ☐ |
| 12.1.3 | Record event | เปิด pixel URL → ตรวจ email_events table | มี row event_type = 'opened' | ☐ |
| 12.1.4 | Invalid eventId | เปิด URL ด้วย eventId ปลอม | ยังส่ง pixel กลับ (ไม่ record) | ☐ |

### 12.2 Click Tracking (Redirect)

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 12.2.1 | Redirect สำเร็จ | เปิด `/api/track/click/<eventId>?url=https://example.com` | redirect 302 ไป https://example.com | ☐ |
| 12.2.2 | ไม่มี url param | เปิด `/api/track/click/<eventId>` (ไม่มี ?url=) | error 400 "Missing url parameter" | ☐ |
| 12.2.3 | URL ไม่ใช่ http/https | `?url=javascript:alert(1)` | error 400 (ป้องกัน open redirect) | ☐ |
| 12.2.4 | URL ไม่ใช่ http/https (ftp) | `?url=ftp://example.com` | error 400 "http or https only" | ☐ |
| 12.2.5 | URL ที่มี query params | `?url=https://example.com/page?utm_source=email` | redirect ไป URL ครบรวม query params | ☐ |
| 12.2.6 | Record event | เปิด click URL → ตรวจ email_events table | มี row event_type = 'clicked' + url | ☐ |
| 12.2.7 | DB error ไม่กระทบ redirect | Database ล่ม → เปิด click URL | ยัง redirect ได้ (fire-and-forget) | ☐ |

### 12.3 Unsubscribe

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 12.3.1 | เปิดหน้า unsubscribe | เปิด `/api/unsubscribe/<token>` | แสดงหน้ายืนยันการ unsubscribe | ☐ |
| 12.3.2 | ยืนยัน unsubscribe | กด "ยืนยัน" | แสดง success page, บันทึกใน unsubscribes table | ☐ |
| 12.3.3 | Invalid token | เปิด URL ด้วย token ปลอม | แสดง error page | ☐ |
| 12.3.4 | Unsubscribe แล้ว ส่งอีก | Lead ที่ unsubscribe แล้ว → campaign ใหม่ | ไม่ส่ง email ให้ lead นี้ | ☐ |

### 12.4 Resend Webhook

> **วิธีทดสอบ**: ใช้ curl หรือ Postman ส่ง POST request

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 12.4.1 | email.sent event | POST webhook ด้วย type: "email.sent" | 200 OK, record event | ☐ |
| 12.4.2 | email.delivered event | POST webhook ด้วย type: "email.delivered" | 200 OK, record event | ☐ |
| 12.4.3 | email.opened event | POST webhook ด้วย type: "email.opened" | 200 OK, record event | ☐ |
| 12.4.4 | email.clicked event | POST webhook ด้วย type: "email.clicked" + click.link | 200 OK, record event + url | ☐ |
| 12.4.5 | email.bounced event | POST webhook ด้วย type: "email.bounced" | 200 OK, update campaign_contact status | ☐ |
| 12.4.6 | email.complained event | POST webhook ด้วย type: "email.complained" | 200 OK, add unsubscribe | ☐ |
| 12.4.7 | Invalid JSON | POST body ที่ไม่ใช่ JSON | 400 error | ☐ |
| 12.4.8 | Missing type | POST JSON ที่ไม่มี "type" | 400 error | ☐ |
| 12.4.9 | Missing email_id | POST JSON ที่ไม่มี data.email_id | 400 error | ☐ |
| 12.4.10 | Unknown email_id | POST ด้วย email_id ที่ไม่มีในระบบ | 200 OK (skip, ไม่ retry) | ☐ |

**ตัวอย่าง curl สำหรับทดสอบ webhook:**

```bash
# email.sent event
curl -X POST http://localhost:3000/api/webhooks/resend \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.sent",
    "data": {
      "email_id": "<message_id_from_resend>",
      "from": "sender@yourdomain.com",
      "to": ["recipient@example.com"],
      "subject": "Test Email"
    }
  }'

# email.bounced event
curl -X POST http://localhost:3000/api/webhooks/resend \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.bounced",
    "data": {
      "email_id": "<message_id>",
      "from": "sender@yourdomain.com",
      "to": ["bounced@example.com"],
      "bounce": {
        "message": "Mailbox not found"
      }
    }
  }'
```

---

## 13. Security & Permission

### 13.1 Role-Based Access

| # | ทดสอบ | Login เป็น | ทำอะไร | ผลที่คาดหวัง | Pass? |
|---|--------|-----------|--------|-------------|-------|
| 13.1.1 | Admin เห็นทุกอย่าง | agency_admin | ดูทุกหน้า | เข้าถึงได้ทั้งหมด | ☐ |
| 13.1.2 | Member จำกัดสิทธิ์ | agency_member | ลบ report | error หรือไม่เห็นปุ่ม | ☐ |
| 13.1.3 | Viewer ดูอย่างเดียว | client_viewer | แก้ไข lead | error หรือไม่เห็นปุ่ม | ☐ |
| 13.1.4 | ไม่ใช่ member | outsider | เข้า workspace URL | redirect ไป workspace selection หรือ error | ☐ |

### 13.2 Cross-Workspace Isolation (RLS)

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 13.2.1 | ดู leads ของ workspace อื่น | สร้าง 2 workspaces, ใส่ leads ต่างกัน → สลับ workspace | เห็นเฉพาะ leads ของ workspace ที่เลือก | ☐ |
| 13.2.2 | ดู campaigns ของ workspace อื่น | เหมือนข้อ 13.2.1 | เห็นเฉพาะ campaigns ของ workspace นั้น | ☐ |
| 13.2.3 | URL tampering | เปลี่ยน workspaceId ใน URL เป็น workspace ที่ไม่ใช่ member | error "FORBIDDEN" | ☐ |

### 13.3 Auth Protection

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 13.3.1 | เข้า dashboard ไม่ login | พิมพ์ URL dashboard ตรงๆ (ไม่ login) | redirect ไป /login | ☐ |
| 13.3.2 | API call ไม่มี token | ใช้ curl เรียก tRPC endpoint ไม่มี header | error 401 | ☐ |
| 13.3.3 | Token หมดอายุ | ปล่อยให้ session expire → พยายามใช้งาน | redirect ไป /login หรือ refresh token | ☐ |

---

## 13.5 UI Redesign Verification (2026-03-14)

> ตรวจสอบ UI ใหม่ที่ redesign ตาม Paper design

### 13.5.1 หน้าที่ redesign ใหม่

| # | หน้า | ตรวจสอบ | Pass? |
|---|------|---------|-------|
| 1 | Login | Split screen: ซ้ายน้ำเงิน (logo+tagline) / ขวาขาว (form+Google OAuth) | ☐ |
| 2 | Workspace Selection | Cards + stats (leads/campaigns/members) + "สร้าง Workspace ใหม่" | ☐ |
| 3 | Sidebar | White theme, 3 กลุ่ม (ทั่วไป/เครื่องมือ/สนับสนุน), active state ไม่ซ้อนกัน | ☐ |
| 4 | Lead Search | 2-panel, auto email enrich, sub-categories multi-select, province dropdown | ☐ |
| 5 | Lead List | Filter pills + แยกคอลัมน์อีเมล/เบอร์ + bulk หา email | ☐ |
| 6 | Lead Detail | 3-column layout, AI score card, Google Places stats, activity timeline | ☐ |
| 7 | Template List | Card grid, category badges+filter, three-dot menu, stats | ☐ |
| 8 | Template Editor | 2-panel split, variable pills insert, Desktop/Mobile preview toggle | ☐ |
| 9 | Sequence List | Row cards, status badges, stats (ผู้รับ/Open/Reply), "แก้ไข" button | ☐ |
| 10 | Sequence Builder | Visual timeline (connector lines, wait pills), right sidebar (stats+settings) | ☐ |
| 11 | Campaign List | Table rows, avatar icons, status badges, pagination, filters | ☐ |
| 12 | Campaign Detail | 5 stat cards, progress bar, right sidebar, recipients table | ☐ |
| 13 | Create Campaign | Step indicator, 2-column, template sidebar, audience filter, day-of-week | ☐ |

### 13.5.2 Social Media Finder

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 1 | หา Facebook Page | ค้นหา lead → ติ๊ก "ค้นหาโซเชียลมีเดีย" → ค้นหา | พบ FB link แสดง icon สีน้ำเงิน | ☐ |
| 2 | หา LINE OA | เว็บที่มี LINE link → ค้นหา | พบ LINE handle แสดง icon สีเขียว | ☐ |
| 3 | เว็บไม่มี social | เว็บที่ไม่มี FB/LINE → ค้นหา | ไม่แสดง icon, ไม่ crash | ☐ |
| 4 | API direct test | `POST /api/v1/social/find` + website | คืน facebook/line objects | ☐ |

### 13.5.3 Coming Soon Pages

| # | หน้า | URL | ตรวจสอบ | Pass? |
|---|------|-----|---------|-------|
| 1 | ช่วยเหลือ | /{workspaceId}/help | แสดง Coming Soon + ปุ่มกลับ | ☐ |

---

## 14. Cross-feature Flows

> ทดสอบ workflow ข้ามฟีเจอร์ตั้งแต่ต้นจนจบ

### 14.1 Flow: Lead → Campaign → Track

| Step | ทำอะไร | ตรวจสอบ | Pass? |
|------|--------|---------|-------|
| 1 | สร้าง leads 5 ตัว (3 มี email, 2 ไม่มี) | leads แสดงใน list | ☐ |
| 2 | สร้าง email template | template แสดงใน list | ☐ |
| 3 | สร้าง campaign เลือก template นี้ | campaign status = "draft" | ☐ |
| 4 | Preview audience | จำนวน = 3 (เฉพาะที่มี email) | ☐ |
| 5 | Schedule campaign | status → "scheduled" | ☐ |
| 6 | (ถ้า Resend เชื่อมจริง) ตรวจ email ที่ส่ง | emails ถูกส่ง 3 ฉบับ | ☐ |
| 7 | เปิด email → pixel load | email_events มี "opened" | ☐ |
| 8 | คลิก link ใน email | redirect + email_events มี "clicked" | ☐ |
| 9 | ดู campaign detail → stats | sent: 3, opened: ?, clicked: ? | ☐ |
| 10 | ดู lead detail → Email Activity | แสดง events ที่เกิดขึ้น | ☐ |

### 14.2 Flow: Lead → Sequence → Multi-step

| Step | ทำอะไร | ตรวจสอบ | Pass? |
|------|--------|---------|-------|
| 1 | สร้าง 3 templates (Welcome, Follow-up, Final) | templates อยู่ใน list | ☐ |
| 2 | สร้าง sequence "Welcome Series" | sequence status = "draft" | ☐ |
| 3 | เพิ่ม step 1: Welcome (delay 0 วัน) | step 1 แสดง | ☐ |
| 4 | เพิ่ม step 2: Follow-up (delay 3 วัน) | step 2 แสดง, order ถูกต้อง | ☐ |
| 5 | เพิ่ม step 3: Final (delay 7 วัน) | step 3 แสดง | ☐ |
| 6 | Activate sequence | status → "active" | ☐ |
| 7 | ไปหน้า Leads → เลือก 5 leads → Enroll | enrolled: 5 (หรือ skip ถ้าไม่มี email) | ☐ |
| 8 | ดู sequence → Enrollments tab | แสดง enrolled leads, current_step = 1 | ☐ |

### 14.3 Flow: Unsubscribe → Stop Sending

| Step | ทำอะไร | ตรวจสอบ | Pass? |
|------|--------|---------|-------|
| 1 | Lead ได้รับ email จาก campaign | email ส่งสำเร็จ | ☐ |
| 2 | Lead คลิก unsubscribe link | หน้ายืนยันแสดง | ☐ |
| 3 | Lead กดยืนยัน unsubscribe | success page, บันทึกใน unsubscribes | ☐ |
| 4 | สร้าง campaign ใหม่ที่ include lead นี้ | lead ไม่ได้รับ email (skip) | ☐ |
| 5 | ดู lead detail | แสดงว่า unsubscribed | ☐ |

### 14.4 Flow: Report → Share → Public View

| Step | ทำอะไร | ตรวจสอบ | Pass? |
|------|--------|---------|-------|
| 1 | มี leads + campaigns + email data ในระบบ | dashboard แสดง stats | ☐ |
| 2 | สร้าง report ตั้ง date range เดือนนี้ | report สร้างสำเร็จ | ☐ |
| 3 | ดู report data | แสดง leads, emails, top campaigns ถูกต้อง | ☐ |
| 4 | สร้าง share link (expires 7 วัน) | ได้ URL | ☐ |
| 5 | เปิด URL ใน incognito (ไม่ login) | แสดง report data ครบ | ☐ |
| 6 | Revoke sharing | link เก่าใช้ไม่ได้ | ☐ |

---

## 15. Edge Cases & Error Handling

### 15.1 Input Validation

| # | ทดสอบ | Input | ผลที่คาดหวัง | Pass? |
|---|--------|-------|-------------|-------|
| 15.1.1 | UUID ไม่ถูกต้อง | workspaceId = "not-a-uuid" | validation error | ☐ |
| 15.1.2 | Email ไม่ถูกรูปแบบ | email = "abc@" | validation error | ☐ |
| 15.1.3 | Score เกิน range | minScore = 150 | validation error | ☐ |
| 15.1.4 | Rating เกิน range | rating = 6.0 | validation error | ☐ |
| 15.1.5 | PageSize เกิน 100 | pageSize = 999 | clamp to 100 หรือ error | ☐ |
| 15.1.6 | Empty string name | name = "" | validation error | ☐ |
| 15.1.7 | XSS ใน input | name = `<script>alert(1)</script>` | ไม่ execute script, แสดงเป็น text | ☐ |
| 15.1.8 | SQL injection | name = `'; DROP TABLE leads;--` | ไม่มีผลกับ DB (parameterized query) | ☐ |

### 15.2 Empty States

| # | หน้า | สถานการณ์ | ผลที่คาดหวัง | Pass? |
|---|------|----------|-------------|-------|
| 15.2.1 | Leads | ไม่มี leads | แสดง empty state + CTA | ☐ |
| 15.2.2 | Campaigns | ไม่มี campaigns | แสดง empty state + CTA | ☐ |
| 15.2.3 | Templates | ไม่มี templates | แสดง empty state + CTA | ☐ |
| 15.2.4 | Sequences | ไม่มี sequences | แสดง empty state + CTA | ☐ |
| 15.2.5 | Reports | ไม่มี reports | แสดง empty state + CTA | ☐ |
| 15.2.6 | Dashboard | Workspace ใหม่ | stats = 0, activity ว่าง | ☐ |

### 15.3 Loading States

| # | หน้า | ตรวจสอบ | Pass? |
|---|------|---------|-------|
| 15.3.1 | Lead list | แสดง skeleton/spinner ขณะโหลด | ☐ |
| 15.3.2 | Dashboard | แสดง skeleton ขณะโหลด stats | ☐ |
| 15.3.3 | Campaign detail | แสดง loading ขณะโหลด contacts | ☐ |

### 15.4 Error States

| # | ทดสอบ | วิธีทำ | ผลที่คาดหวัง | Pass? |
|---|--------|--------|-------------|-------|
| 15.4.1 | Network error | ปิด internet → กดปุ่มอะไรสักอย่าง | แสดง error toast/message | ☐ |
| 15.4.2 | Server error | Server return 500 | แสดง error message ที่เข้าใจได้ | ☐ |
| 15.4.3 | Not found | เปลี่ยน leadId ใน URL เป็น UUID ปลอม | แสดง 404 หรือ redirect | ☐ |

---

## Appendix: Automated Tests ที่มีอยู่แล้ว

รัน automated tests ก่อน manual testing เสมอ:

```bash
# Unit & Integration Tests (Vitest) — 111 tests
cd apps/web && npx vitest run

# Build check — ตรวจว่า compile ได้
cd apps/web && npm run build

# E2E Tests (Playwright) — ต้องรัน dev server ก่อน
cd apps/web && npx playwright test
```

**Test coverage ปัจจุบัน:**
| Suite | จำนวน | Coverage |
|-------|-------|---------|
| tRPC Router Tests (lead, campaign) | 49 tests | list, create, update, delete, bulk ops, auth |
| Webhook Tests (resend) | 11 tests | all event types, error handling |
| Tracking Tests (open, click) | 16 tests | redirect, validation, security |
| Template Variable Tests | 29 tests | all variables, edge cases |
| E2E Tests (Playwright) | 9 specs | auth, dashboard, leads, campaigns, settings |
