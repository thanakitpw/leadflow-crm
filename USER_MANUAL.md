# คู่มือการใช้งาน LeadFlow
## ระบบ AI Lead Generation + Email Outreach

> เวอร์ชัน 1.0 | อัพเดทล่าสุด: มีนาคม 2026

---

## สารบัญ

1. [ภาพรวมระบบ](#1-ภาพรวมระบบ)
2. [เริ่มต้นใช้งาน](#2-เริ่มต้นใช้งาน)
3. [Dashboard](#3-dashboard)
4. [Lead Generation — ค้นหาลูกค้า](#4-lead-generation--ค้นหาลูกค้า)
5. [Lead Management — จัดการ Leads](#5-lead-management--จัดการ-leads)
6. [Email Templates — เทมเพลตอีเมล](#6-email-templates--เทมเพลตอีเมล)
7. [Email Campaigns — แคมเปญอีเมล](#7-email-campaigns--แคมเปญอีเมล)
8. [Email Sequences — ลำดับอีเมลอัตโนมัติ](#8-email-sequences--ลำดับอีเมลอัตโนมัติ)
9. [Reports — รายงาน](#9-reports--รายงาน)
10. [Settings — ตั้งค่า](#10-settings--ตั้งค่า)
11. [Python API — บริการ AI](#11-python-api--บริการ-ai)
12. [สถาปัตยกรรมระบบ](#12-สถาปัตยกรรมระบบ)
13. [คำถามที่พบบ่อย (FAQ)](#13-คำถามที่พบบ่อย-faq)

---

## 1. ภาพรวมระบบ

### LeadFlow คืออะไร?

LeadFlow เป็นระบบ **AI Lead Generation + Email Outreach** ออกแบบมาสำหรับ Marketing Agency ขนาด 4-10 คน ใช้ AI ช่วยในการ:

- **ค้นหาลูกค้าเป้าหมาย** จาก Google Places API ตามประเภทธุรกิจและพื้นที่
- **หาอีเมลอัตโนมัติ** ด้วย Web Scraping + AI (แทน Hunter.io)
- **ให้คะแนน Lead** ด้วย Claude AI (0-100 คะแนน พร้อมเหตุผล)
- **ส่งอีเมลแบบ Personalized** ด้วย AI เขียนอีเมลให้
- **ติดตามผล** Open Rate, Click Rate, Bounce Rate แบบ Real-time

### กลุ่มเป้าหมาย

| กลุ่ม | รายละเอียด |
|---|---|
| F&B | ร้านอาหาร, คาเฟ่, เบเกอรี่ |
| SME | ธุรกิจขนาดเล็ก-กลาง |
| อสังหาริมทรัพย์ | คอนโด, บ้านจัดสรร, โรงแรม |
| B2B/Corporate | บริษัท, โรงงาน, สำนักงาน |

### ระบบ Multi-tenant

LeadFlow รองรับการใช้งานแบบหลาย workspace:

```
Agency Admin (Super Admin)
    │
    ├── Agency Workspace (ใช้งานเอง)
    │       ├── Leads
    │       └── Email Campaigns
    │
    ├── Client Workspace: "ร้านอาหาร A"
    │       ├── Leads (Agency หาให้)
    │       └── Reports (client ดูได้)
    │
    └── Client Workspace: "บริษัท B"
            ├── Leads
            └── Reports
```

### บทบาทผู้ใช้ (Roles)

| Role | สิทธิ์ |
|---|---|
| **Agency Admin** | จัดการทุกอย่าง — workspace, สมาชิก, leads, campaigns, settings |
| **Agency Member** | ทำงานใน workspace ที่ได้รับมอบหมาย — leads, campaigns |
| **Client Viewer** | ดูรายงานได้อย่างเดียว |

---

## 2. เริ่มต้นใช้งาน

### 2.1 สมัครสมาชิก

1. เปิดเว็บ LeadFlow → คลิก **"สมัครสมาชิก"**
2. กรอก **อีเมล** และ **รหัสผ่าน** หรือคลิก **"Sign up with Google"**
3. ยืนยันอีเมล (ตรวจสอบกล่องจดหมาย)
4. ระบบจะพาไปหน้า **Onboarding** → ตั้งชื่อ Agency และสร้าง Workspace แรก

### 2.2 เข้าสู่ระบบ

1. เปิดหน้า Login → กรอก **อีเมล** + **รหัสผ่าน**
2. หรือคลิก **"Sign in with Google"**
3. ระบบจะพาไปหน้า **เลือก Workspace** (ถ้ามีหลาย workspace)
4. เลือก workspace ที่ต้องการ → เข้าสู่ **Dashboard**

### 2.3 ลืมรหัสผ่าน

1. หน้า Login → คลิก **"ลืมรหัสผ่าน?"**
2. กรอกอีเมล → ระบบจะส่ง link reset password
3. คลิก link ในอีเมล → ตั้งรหัสผ่านใหม่

### 2.4 เลือก / สลับ Workspace

- หน้าแรกหลัง login จะแสดง workspace ทั้งหมดที่คุณเป็นสมาชิก
- คลิกเลือก workspace เพื่อเข้าทำงาน
- ต้องการสลับ workspace → คลิก **User Menu** (มุมล่างซ้ายใน sidebar) → **"เปลี่ยน Workspace"**

---

## 3. Dashboard

หน้า Dashboard เป็นหน้าหลักที่แสดงภาพรวมของ workspace

### 3.1 Stats Cards (6 การ์ดสถิติ)

| การ์ด | คำอธิบาย |
|---|---|
| **Leads ทั้งหมด** | จำนวน lead ทั้งหมดใน workspace |
| **มีอีเมล** | จำนวน lead ที่หาอีเมลเจอแล้ว |
| **Campaigns** | จำนวน campaign ที่สร้างไว้ |
| **อีเมลส่งแล้ว** | จำนวนอีเมลที่ส่งไปแล้วทั้งหมด |
| **Open Rate** | อัตราการเปิดอีเมล (%) |
| **Click Rate** | อัตราการคลิกลิงก์ในอีเมล (%) |

### 3.2 กิจกรรมล่าสุด (Activity Feed)

แสดงรายการกิจกรรมล่าสุดของทีม เช่น:
- สร้าง lead ใหม่
- ส่ง campaign
- อัพเดทสถานะ lead
- สร้าง template

### 3.3 Quick Actions (ทางลัด)

| ปุ่ม | ไปหน้า |
|---|---|
| **ค้นหา Leads** | หน้าค้นหา lead จาก Google Places |
| **สร้าง Campaign** | หน้าสร้าง email campaign ใหม่ |
| **ดูรายงาน** | หน้ารายงานสรุปผล |

---

## 4. Lead Generation — ค้นหาลูกค้า

### 4.1 การค้นหา Lead

**เข้าถึง:** Sidebar → **Leads** → ปุ่ม **"ค้นหา Leads"** (หรือ Quick Action จาก Dashboard)

#### ขั้นตอนการค้นหา:

1. **กรอก Keyword** — เช่น "ร้านอาหาร", "คาเฟ่", "โรงแรม"
2. **เลือก Category Preset** (ทางเลือก):
   - 🍽️ F&B — ร้านอาหาร, คาเฟ่, เบเกอรี่
   - 🏢 SME — ธุรกิจขนาดเล็ก-กลาง
   - 🏠 อสังหาริมทรัพย์ — คอนโด, บ้านจัดสรร
   - 💼 B2B — บริษัท, สำนักงาน
3. **เลือกพื้นที่** — เมืองหรือจังหวัด (City Presets)
4. **ปรับ Radius** — รัศมีการค้นหา (500m - 5,000m)
5. คลิก **"ค้นหา"**

#### ผลลัพธ์การค้นหา:

ระบบจะแสดงรายชื่อธุรกิจที่พบ โดยแต่ละรายการประกอบด้วย:
- ชื่อธุรกิจ
- ที่อยู่
- เบอร์โทรศัพท์
- เว็บไซต์ (ถ้ามี)
- Rating / Reviews
- สถานะการเปิดปิด

#### บันทึก Leads:

1. **เลือกทีละรายการ** — ติ๊ก checkbox หน้ารายการที่ต้องการ
2. **เลือกทั้งหมด** — ติ๊ก checkbox ด้านบนตาราง
3. คลิก **"บันทึก X leads"** → ระบบจะบันทึกลง workspace

> **หมายเหตุ:** ระบบตรวจจับ Duplicate อัตโนมัติ — ถ้า lead มี `place_id` ซ้ำจะไม่บันทึกซ้ำ

### 4.2 AI Pipeline อัตโนมัติ (Orchestrator)

เมื่อค้นหาผ่าน Full Pipeline ระบบจะทำงาน 4 ขั้นตอนอัตโนมัติ:

```
1. ค้นหา (Google Places API)
       ↓
2. หาอีเมล (Web Scraping + Claude AI)
       ↓
3. ให้คะแนน (Claude AI Scoring 0-100)
       ↓
4. บันทึกลง Database
```

#### AI Email Finder — วิธีหาอีเมล:

| ขั้นตอน | วิธี | ความแม่นยำ |
|---|---|---|
| 1 | Scrape หน้า homepage + /contact + /about | - |
| 2 | หา `mailto:` links | 95% |
| 3 | Regex หา email จาก HTML | 80% |
| 4 | Claude AI อ่านเนื้อหาหน้าเว็บ | 75% |
| 5 | เดา pattern (info@, contact@, hello@) | 50% |
| 6 | ตรวจ MX Record ยืนยัน domain | ✓/✗ |

#### Claude Lead Scoring — เกณฑ์ให้คะแนน:

Claude AI วิเคราะห์จากหลายปัจจัย:
- Rating บน Google (★)
- จำนวน reviews
- มีเว็บไซต์หรือไม่
- มีอีเมลหรือไม่
- ประเภทธุรกิจ
- ทำเลที่ตั้ง

ผลลัพธ์: **คะแนน 0-100** + **เหตุผลภาษาไทย**

| ช่วงคะแนน | ความหมาย |
|---|---|
| 80-100 | Lead คุณภาพสูง — ควรติดต่อทันที |
| 60-79 | Lead น่าสนใจ — ควรพิจารณา |
| 40-59 | Lead ปานกลาง — อาจต้องข้อมูลเพิ่ม |
| 0-39 | Lead คุณภาพต่ำ — ไม่แนะนำ |

---

## 5. Lead Management — จัดการ Leads

### 5.1 หน้ารายการ Leads

**เข้าถึง:** Sidebar → **Leads**

#### คุณสมบัติ:

| ฟีเจอร์ | คำอธิบาย |
|---|---|
| **Filter by Status** | กรอง: ใหม่, ติดต่อแล้ว, สนใจ, ไม่สนใจ, ปิดการขาย |
| **Filter by Email** | กรอง: มีอีเมล / ไม่มีอีเมล |
| **Sort** | เรียง: คะแนน (สูง→ต่ำ), ชื่อ, วันที่เพิ่ม |
| **Search** | ค้นหาชื่อธุรกิจ |
| **Pagination** | แบ่งหน้า 20 รายการ/หน้า |

#### Bulk Actions (ทำทีละหลายรายการ):

1. ติ๊ก checkbox เลือก leads ที่ต้องการ
2. แถบ Bulk Actions จะปรากฏ:
   - **ลบ** — ลบ leads ที่เลือก (ต้อง confirm)
   - **Export CSV** — ส่งออกเป็นไฟล์ CSV เฉพาะที่เลือก
   - **Enroll in Sequence** — นำ leads เข้า email sequence

### 5.2 หน้ารายละเอียด Lead

**เข้าถึง:** คลิกชื่อ lead จากรายการ

#### ข้อมูลที่แสดง:

| ส่วน | รายละเอียด |
|---|---|
| **ข้อมูลพื้นฐาน** | ชื่อ, ที่อยู่, เบอร์โทร, เว็บไซต์, อีเมล |
| **AI Score** | คะแนน 0-100 + เหตุผลจาก Claude |
| **Tags** | ป้ายกำกับ (เพิ่ม/ลบได้) |
| **Notes** | บันทึกข้อมูลเพิ่มเติม (auto-save) |
| **Status** | สถานะปัจจุบัน (เปลี่ยนได้) |
| **Email Activity** | ประวัติการส่งอีเมล (sent, opened, clicked) |

#### การจัดการ Tags:

- คลิก **"+ เพิ่ม Tag"** → พิมพ์ชื่อ tag → Enter
- คลิก **✕** บน tag เพื่อลบ
- ตัวอย่าง tags: `hot-lead`, `f&b`, `bangkok`, `follow-up`

#### การแก้ไข Notes:

- พิมพ์ข้อมูลในช่อง Notes
- ระบบ auto-save อัตโนมัติ (มี indicator แสดงสถานะบันทึก)

### 5.3 Export CSV

- หน้ารายการ Leads → คลิก **"Export CSV"**
- ไฟล์ CSV จะมี headers ภาษาไทย:
  - ชื่อธุรกิจ, อีเมล, โทรศัพท์, ที่อยู่, เว็บไซต์, สถานะ, คะแนน AI, วันที่เพิ่ม

---

## 6. Email Templates — เทมเพลตอีเมล

### 6.1 หน้ารายการ Templates

**เข้าถึง:** Sidebar → **Templates**

- แสดงเป็น **Grid Cards** พร้อม preview
- กรองตาม **Category**:
  - Cold Outreach — ติดต่อครั้งแรก
  - Follow Up — ติดตามผล
  - Introduction — แนะนำตัว
  - Promotion — โปรโมชัน
  - Newsletter — จดหมายข่าว
  - Re-engagement — กลับมาติดต่อ

### 6.2 สร้าง/แก้ไข Template

**เข้าถึง:** คลิก template จากรายการ หรือ ปุ่ม **"สร้างเทมเพลตใหม่"**

#### Template Editor:

| ส่วน | คำอธิบาย |
|---|---|
| **ชื่อ Template** | ตั้งชื่อเพื่อจำได้ง่าย |
| **Subject Line** | หัวข้ออีเมล |
| **HTML Editor** (ซ้าย) | เขียน HTML code |
| **Live Preview** (ขวา) | ดูผลลัพธ์แบบ real-time |
| **Category** | เลือกหมวดหมู่ |

#### ตัวแปร (Variables):

ใช้ตัวแปรเพื่อ personalize อีเมลอัตโนมัติ:

| ตัวแปร | แทนค่า |
|---|---|
| `{{first_name}}` | ชื่อผู้รับ |
| `{{business_name}}` | ชื่อธุรกิจ |
| `{{location}}` | ที่อยู่/ทำเล |
| `{{category}}` | ประเภทธุรกิจ |
| `{{website}}` | เว็บไซต์ |
| `{{phone}}` | เบอร์โทรศัพท์ |

#### ตัวอย่าง:

```html
<h1>สวัสดีครับ {{first_name}}</h1>
<p>ผมสนใจธุรกิจ {{business_name}} ของคุณ
   ที่ {{location}} มากครับ</p>
```

### 6.3 ทดสอบส่ง Template (Test Send)

1. เปิด Template Editor
2. คลิก **"ทดสอบส่ง"**
3. กรอกอีเมลที่ต้องการรับ test
4. ระบบจะส่งอีเมลพร้อม prefix `[ทดสอบ]` ใน subject
5. ตัวแปร `{{business_name}}` จะถูกแทนด้วยข้อมูลตัวอย่าง

> **หมายเหตุ:** Test send จะไม่มี tracking pixel, click tracking หรือ unsubscribe footer

### 6.4 Duplicate Template

- หน้ารายการ Templates → คลิก **⋮** → **"Duplicate"**
- ระบบจะสร้าง copy พร้อมชื่อ "(สำเนา)"

### 6.4 Claude AI เขียนอีเมล

Python API สามารถ generate email อัตโนมัติ:

- **Generate Email** — ส่ง lead profile → Claude เขียนอีเมล personalized
- **Suggest Subject Lines** — แนะนำหัวข้ออีเมลหลายตัวเลือก
- **A/B Variants** — สร้าง 2 versions สำหรับทดสอบ
- **Tone Options** — เลือก formal / friendly / casual

---

## 7. Email Campaigns — แคมเปญอีเมล

### 7.1 หน้ารายการ Campaigns

**เข้าถึง:** Sidebar → **Campaigns**

แสดงรายการ campaigns พร้อมสถิติ:
- ชื่อ campaign
- สถานะ (Draft / Scheduled / Sending / Sent / Paused / Cancelled)
- จำนวนผู้รับ
- Open Rate / Click Rate

### 7.2 สร้าง Campaign ใหม่

**เข้าถึง:** ปุ่ม **"สร้าง Campaign"**

#### ขั้นตอน:

1. **ตั้งชื่อ Campaign** — ชื่อที่จำได้ง่าย
2. **เลือก Template** — เลือกจาก template ที่สร้างไว้
3. **เลือก Sending Domain** — domain ที่จะส่ง (ต้อง verify แล้ว)
4. **กำหนด Audience** — เลือกผู้รับ:
   - **ทุก leads** — ส่งถึงทุกคน
   - **กรองตามคะแนน** — เช่น score > 60
   - **กรองตามสถานะ** — เช่น เฉพาะ "ใหม่"
   - **กรองมีอีเมล** — เฉพาะ leads ที่มีอีเมล
5. **Preview** — ดูจำนวนผู้รับก่อนส่ง
6. **Schedule (ทางเลือก)** — ตั้งเวลาส่ง วัน/เวลาที่ต้องการ
7. คลิก **"สร้าง Campaign"** หรือ **"สร้างและส่งทันที"**

### 7.3 Campaign Detail

**เข้าถึง:** คลิกชื่อ campaign จากรายการ

#### สถิติที่แสดง:

| Metric | คำอธิบาย |
|---|---|
| **Sent** | จำนวนอีเมลที่ส่งแล้ว |
| **Delivered** | ส่งถึงกล่องจดหมาย |
| **Opened** | เปิดอ่าน (%) |
| **Clicked** | คลิกลิงก์ (%) |
| **Bounced** | ส่งไม่ถึง (%) |
| **Complained** | ถูก report spam |

#### ตาราง Recipients:

แสดงรายชื่อผู้รับทั้งหมด พร้อมสถานะแต่ละคน (sent, opened, clicked, bounced)

### 7.4 การส่ง Campaign จริง

เมื่อกดส่ง ระบบจะทำงานดังนี้:

1. **ตรวจสอบ** — campaign ต้องมี template และ status เป็น draft/scheduled/paused
2. **อัพเดทสถานะ** → `sending`
3. **โหลด leads** ตาม audience filter (เฉพาะที่มีอีเมล)
4. **ตรวจ unsubscribe** — ข้ามคนที่ unsubscribed แล้ว
5. **ส่งทีละคน** — แทนที่ variables, ฝัง tracking pixel, wrap links, เพิ่ม unsubscribe footer
6. **บันทึกผล** — campaign_contacts + email_events
7. **อัพเดทสถานะ** → `sent`

> **Scheduled Campaign:** ระบบมี cron job ตรวจทุกนาที — ถ้า campaign ถึงเวลาที่ตั้งไว้จะส่งอัตโนมัติ

### 7.5 การจัดการ Campaign

| Action | คำอธิบาย |
|---|---|
| **Send Now** | ส่งทันที (กดจากหน้า campaign detail) |
| **Pause** | หยุดส่งชั่วคราว (สำหรับ campaign ที่กำลังส่ง) |
| **Cancel** | ยกเลิก campaign (ไม่สามารถส่งต่อได้) |
| **Delete** | ลบ campaign (draft เท่านั้น) |

### 7.5 Daily Sending Limit

ระบบมี **Warm-up Schedule** ป้องกัน spam:

| วันที่ | Limit ต่อวัน |
|---|---|
| วันที่ 1-3 | 10 อีเมล |
| วันที่ 4-7 | 25 อีเมล |
| วันที่ 8-14 | 50 อีเมล |
| วันที่ 15-21 | 100 อีเมล |
| วันที่ 22+ | ไม่จำกัด |

---

## 8. Email Sequences — ลำดับอีเมลอัตโนมัติ

### 8.1 Sequence คืออะไร?

Sequence คือชุดอีเมลที่ส่งอัตโนมัติตามลำดับ โดยมี delay ระหว่างแต่ละ step เช่น:

```
Day 0:  ส่งอีเมลแนะนำตัว
            ↓ (รอ 3 วัน)
Day 3:  ส่ง follow-up #1
            ↓ (รอ 5 วัน)
Day 8:  ส่ง follow-up #2 (ข้อเสนอพิเศษ)
            ↓ (รอ 7 วัน)
Day 15: ส่งอีเมลสุดท้าย (last chance)
```

### 8.2 หน้ารายการ Sequences

**เข้าถึง:** Sidebar → **Sequences**

แสดงรายการ sequences พร้อม:
- ชื่อ sequence
- จำนวน steps
- จำนวน enrollments (leads ที่อยู่ใน sequence)
- สถานะ (Active / Paused)

### 8.3 สร้าง / แก้ไข Sequence

**เข้าถึง:** คลิก sequence หรือ ปุ่ม **"สร้าง Sequence"**

#### Sequence Builder (Visual Timeline):

1. **เพิ่ม Step** → คลิก **"+ เพิ่ม Step"**
2. **เลือก Template** → เลือก email template สำหรับ step นี้
3. **กำหนด Delay** → จำนวนวันที่รอก่อนส่ง step ถัดไป
4. **ลำดับ Steps** → ลากเพื่อจัดลำดับ
5. **ลบ Step** → คลิกไอคอนถังขยะ

### 8.4 การส่งอีเมล Sequence อัตโนมัติ

เมื่อ enroll leads แล้ว ระบบมี cron job ทำงานทุก 15 นาที:

1. **ตรวจสอบ enrollments** ที่ `status = active`
2. **คำนวณ delay** — ถ้า delay_days ครบแล้ว → ส่ง step ถัดไป
3. **ส่งอีเมล** พร้อม replace variables จากข้อมูล lead
4. **อัพเดทสถานะ** — current_step + 1, บันทึก last_step_at
5. **จบ sequence** — ถ้าไม่มี step ถัดไป → status = completed

### 8.5 Enroll Leads เข้า Sequence

#### วิธีที่ 1: จากหน้า Lead List

1. ติ๊กเลือก leads ที่ต้องการ
2. คลิก **"Enroll in Sequence"** ใน Bulk Actions
3. เลือก sequence จาก dropdown
4. คลิก **"ยืนยัน"**

#### วิธีที่ 2: จากหน้า Lead Detail

1. เปิดหน้ารายละเอียด lead
2. คลิก **"Enroll in Sequence"**
3. เลือก sequence → คลิก **"ยืนยัน"**

### 8.5 Enrollments Panel

ในหน้า Sequence Builder จะมี **Enrollments Panel** แสดง:
- รายชื่อ leads ที่อยู่ใน sequence
- Step ปัจจุบันของแต่ละ lead
- สถานะ: Active / Completed / Stopped

---

## 9. Reports — รายงาน

### 9.1 หน้ารายงาน

**เข้าถึง:** Sidebar → **รายงาน**

#### สร้างรายงานใหม่:

1. คลิก **"สร้างรายงาน"**
2. เลือก **ช่วงวันที่** (Date From - Date To)
3. ตั้ง **วันหมดอายุ** ของ share link
4. คลิก **"สร้าง"**

### 9.2 เนื้อหารายงาน

| ส่วน | ข้อมูล |
|---|---|
| **สรุปภาพรวม** | จำนวน leads, อีเมลส่ง, Open Rate, Click Rate |
| **Campaign Performance** | ตารางผลลัพธ์แต่ละ campaign |
| **Top Leads** | Leads ที่มีคะแนนสูงสุด |

### 9.3 แชร์รายงาน

- แต่ละรายงานมี **Share Link** (token-based)
- คลิก **"คัดลอกลิงก์"** → ส่งให้ client
- **ไม่ต้อง login** เพื่อดูรายงาน
- ตั้ง **วันหมดอายุ** ได้ (หลังวันหมดอายุจะเปิดไม่ได้)
- สามารถ **Regenerate Token** ได้ (link เก่าจะใช้ไม่ได้)

### 9.4 Export PDF

- เปิดรายงาน → ใช้ **Print to PDF** ของ browser (Ctrl+P / Cmd+P)
- หรือเรียก Python API `POST /api/v1/report/generate-html` เพื่อสร้าง printable HTML

---

## 10. Settings — ตั้งค่า

**เข้าถึง:** Sidebar → **Settings** (ต้องเป็น Admin หรือ Member)

### 10.1 General Settings

| ตั้งค่า | คำอธิบาย |
|---|---|
| **ชื่อ Workspace** | เปลี่ยนชื่อ workspace |
| **ลบ Workspace** | ลบ workspace (ต้อง confirm, admin เท่านั้น) |

### 10.2 Members — จัดการสมาชิก

#### Invite สมาชิกใหม่:

1. คลิก **"เชิญสมาชิก"**
2. กรอก **อีเมล** ของผู้ที่ต้องการเชิญ
3. เลือก **Role**: Agency Admin / Agency Member / Client Viewer
4. คลิก **"ส่งคำเชิญ"**

#### จัดการสมาชิก:

- **เปลี่ยน Role** — คลิก ⋮ → Change Role
- **ลบสมาชิก** — คลิก ⋮ → Remove (admin เท่านั้น)

### 10.3 Domains — ตั้งค่า Domain สำหรับส่งอีเมล

#### เพิ่ม Sending Domain:

1. คลิก **"เพิ่ม Domain"**
2. กรอก **ชื่อ domain** (เช่น `youragency.com`)
3. ระบบจะแสดง **DNS Records** ที่ต้องตั้งค่า:

| Record Type | ชื่อ | ค่า | วัตถุประสงค์ |
|---|---|---|---|
| **TXT** | `@` | `v=spf1 include:...` | SPF — ยืนยันว่า server มีสิทธิ์ส่ง |
| **TXT** | `resend._domainkey` | `v=DKIM1; k=rsa; p=...` | DKIM — ลายเซ็นดิจิทัล |
| **TXT** | `_dmarc` | `v=DMARC1; p=none; ...` | DMARC — นโยบายการป้องกัน |

4. ตั้งค่า DNS Records ที่ domain registrar ของคุณ
5. กลับมาคลิก **"Verify"** เพื่อตรวจสอบ
6. เมื่อ verify สำเร็จ → domain พร้อมใช้ส่งอีเมล

---

## 11. Python API — บริการ AI

Python API (FastAPI) เป็น microservice ที่ทำหน้าที่:

### 11.1 Endpoints ทั้งหมด

#### Places API — ค้นหาธุรกิจ

| Method | Path | คำอธิบาย |
|---|---|---|
| POST | `/api/v1/places/search` | ค้นหาธุรกิจ (keyword เดียว) |
| POST | `/api/v1/places/search-batch` | ค้นหาหลาย keyword (max 10) |
| GET | `/api/v1/places/details/{place_id}` | ดึง place details |

#### Enrichment — หาอีเมล

| Method | Path | คำอธิบาย |
|---|---|---|
| POST | `/api/v1/enrichment/find-email` | ค้นหา email จากเว็บไซต์ |

#### Scoring — ให้คะแนน Lead

| Method | Path | คำอธิบาย |
|---|---|---|
| POST | `/api/v1/scoring/score` | ให้คะแนน lead เดียว (0-100) |
| POST | `/api/v1/scoring/score-batch` | ให้คะแนนหลาย leads (max 10) |

#### Orchestrator — Full Pipeline

| Method | Path | คำอธิบาย |
|---|---|---|
| POST | `/api/v1/orchestrate` | Full pipeline: search → enrich → score → save |

#### Email — สร้างและส่งอีเมล

| Method | Path | คำอธิบาย |
|---|---|---|
| POST | `/api/v1/email/generate` | Claude เขียนอีเมล personalized |
| POST | `/api/v1/email/generate-ab` | สร้าง A/B email variants |
| POST | `/api/v1/email/suggest-subjects` | แนะนำ subject lines |
| POST | `/api/v1/email/send` | ส่ง email เดียว |
| POST | `/api/v1/email/send-batch` | ส่ง email batch (max 100) |

#### Tracking — ติดตามอีเมล

| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/api/v1/track/open/{event_id}` | Tracking pixel (บันทึก open) |
| GET | `/api/v1/track/click/{event_id}` | Click tracking redirect |
| GET | `/api/v1/unsubscribe/{token}` | หน้า unsubscribe |
| POST | `/webhooks/resend` | Resend webhook handler |

#### Report — สร้างรายงาน

| Method | Path | คำอธิบาย |
|---|---|---|
| POST | `/api/v1/report/generate-html` | สร้าง printable HTML report |

### 11.2 Cache Strategy

ระบบ cache ผลลัพธ์จาก Google Places API เพื่อประหยัดค่าใช้จ่าย:

| ประเภท | TTL (อายุ cache) |
|---|---|
| ผลการค้นหา (list) | 7 วัน |
| Place Details | 30 วัน |

**Radius Bucketing:** ปัด radius เป็น 500 / 1,000 / 2,000 / 5,000m เพื่อเพิ่ม cache hit rate

---

## 12. สถาปัตยกรรมระบบ

### 12.1 Tech Stack

| Layer | เทคโนโลยี |
|---|---|
| **Frontend** | Next.js 14 (App Router) + TypeScript |
| **UI** | Tailwind CSS + shadcn/ui |
| **Backend API** | tRPC (type-safe) |
| **AI/Enrichment** | Python FastAPI |
| **Database** | Supabase (PostgreSQL + RLS) |
| **Email** | Resend (→ AWS SES เมื่อ scale) |
| **Background Jobs** | Trigger.dev |
| **AI Model** | Claude API (claude-sonnet-4-6) |

### 12.2 Architecture Diagram

```
┌─────────────────────────────────────────────┐
│              Next.js App (SaaS)              │
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │Lead Gen  │ │Email     │ │Reports &     │ │
│  │UI        │ │Outreach  │ │Dashboard     │ │
│  │          │ │UI        │ │              │ │
│  └────┬─────┘ └────┬─────┘ └──────┬───────┘ │
│       │            │              │          │
│       └────────┬───┘──────────────┘          │
│                │                             │
│          tRPC API Layer                      │
└────────────────┬─────────────────────────────┘
                 │
    ┌────────────┼────────────────┐
    │            │                │
    ▼            ▼                ▼
┌────────┐ ┌──────────┐ ┌─────────────┐
│Supabase│ │Python API│ │Trigger.dev  │
│        │ │(FastAPI) │ │(Background) │
│- Auth  │ │          │ │             │
│- DB    │ │- Places  │ │- Campaigns  │
│- RLS   │ │- Scraper │ │- Sequences  │
│- RT    │ │- Claude  │ │- Warmup     │
└────────┘ │- Email   │ └──────┬──────┘
           └────┬─────┘        │
                │              │
    ┌───────────┼──────┐       │
    │           │      │       │
    ▼           ▼      ▼       ▼
Google      Web     Claude   Resend
Places    Scraping   API    / AWS SES
API
```

### 12.3 Database Tables

| Module | Tables |
|---|---|
| **Auth** | `profiles`, `agencies`, `workspaces`, `workspace_members`, `audit_logs` |
| **Leads** | `leads`, `lead_scores`, `lead_tags`, `places_cache` |
| **Email** | `email_templates`, `campaigns`, `campaign_contacts`, `sequences`, `sequence_steps`, `sequence_enrollments`, `email_events`, `unsubscribes`, `sending_domains` |
| **Reports** | `client_reports`, `activity_feed` |
| **Views** | `workspace_stats` |

### 12.4 Security — Row Level Security (RLS)

ทุก table มี RLS policies:
- ผู้ใช้เห็นเฉพาะข้อมูลใน workspace ของตัวเอง
- ไม่สามารถเข้าถึงข้อมูลข้าม workspace ได้
- Admin มีสิทธิ์มากกว่า Member
- Client Viewer ดูได้อย่างเดียว

---

## 13. คำถามที่พบบ่อย (FAQ)

### Q: ระบบนี้ต่างจาก Hunter.io อย่างไร?
**A:** LeadFlow สร้าง Email Finder เอง (Web Scraping + Claude AI + MX Validation) แทนการใช้ Hunter.io ประหยัด $49-299/เดือน โดยยังคงความแม่นยำ 75-95%

### Q: ค่าใช้จ่ายต่อเดือนเท่าไหร่?
**A:** สำหรับ Agency ขนาดเล็ก (~500 leads, 5,000 emails/เดือน) ประมาณ **$28/เดือน (~1,000 บาท)**

| รายการ | ค่าใช้จ่าย |
|---|---|
| Google Places API | ฟรี (free tier) |
| AI Email Finder (Claude) | ~$4 |
| Claude Lead Scoring | ~$4 |
| Resend (Email) | $20 |
| Supabase | ฟรี |
| Trigger.dev | ฟรี |

### Q: รองรับภาษาไทยไหม?
**A:** ใช่ ทั้งหมด — UI ภาษาไทย, Claude เขียนอีเมลภาษาไทย, AI Scoring ให้เหตุผลภาษาไทย, รายงานภาษาไทย, CSV export headers ภาษาไทย

### Q: ส่งอีเมลได้สูงสุดกี่ฉบับต่อวัน?
**A:** ขึ้นอยู่กับ domain warm-up:
- สัปดาห์แรก: 10-25/วัน
- สัปดาห์ที่ 2: 50/วัน
- สัปดาห์ที่ 3: 100/วัน
- หลัง 22 วัน: ไม่จำกัด (ตาม plan)

### Q: ข้อมูลปลอดภัยไหม?
**A:** ใช่ ระบบมี:
- **Row Level Security (RLS)** — แยกข้อมูลตาม workspace
- **Supabase Auth** — การยืนยันตัวตนที่ปลอดภัย
- **HTTPS** — เข้ารหัสข้อมูลระหว่างส่ง
- **Role-based access** — สิทธิ์ตามบทบาท

### Q: สามารถใช้กับ domain ของตัวเองได้ไหม?
**A:** ได้ — ไปที่ Settings → Domains → เพิ่ม domain → ตั้งค่า DNS (SPF/DKIM/DMARC) → Verify

### Q: ระบบ track email ได้อย่างไร?
**A:** ระบบใช้:
- **Tracking Pixel** — ฝัง 1x1 pixel ใน email เพื่อ track การเปิดอ่าน
- **Link Wrapping** — ห่อ link ด้วย redirect URL เพื่อ track การคลิก
- **Webhooks** — รับ events จาก Resend (delivered, bounced, complained)
- **Unsubscribe Link** — ฝังใน footer ทุกอีเมลอัตโนมัติ

### Q: ต้องการ API Keys อะไรบ้าง?

| Key | ใช้ทำอะไร | หาได้จาก |
|---|---|---|
| `ANTHROPIC_API_KEY` | Lead scoring + Email writing | [console.anthropic.com](https://console.anthropic.com/) |
| `GOOGLE_PLACES_API_KEY` | ค้นหาธุรกิจ | [console.cloud.google.com](https://console.cloud.google.com/) |
| `RESEND_API_KEY` | ส่งอีเมล | [resend.com](https://resend.com/) |
| `TRIGGER_API_KEY` | Background jobs | [trigger.dev](https://trigger.dev/) |

---

## ภาคผนวก

### A. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+K` / `Cmd+K` | Quick Search |
| `Esc` | ปิด Dialog / Modal |

### B. สถานะ Lead

| สถานะ | ความหมาย |
|---|---|
| `new` | Lead ใหม่ ยังไม่ได้ติดต่อ |
| `contacted` | ติดต่อแล้ว รอตอบกลับ |
| `interested` | สนใจ ต้องการข้อมูลเพิ่ม |
| `not_interested` | ไม่สนใจ |
| `converted` | ปิดการขาย / เป็นลูกค้าแล้ว |

### C. สถานะ Campaign

| สถานะ | ความหมาย |
|---|---|
| `draft` | ร่าง ยังไม่ส่ง |
| `scheduled` | ตั้งเวลาส่งแล้ว |
| `sending` | กำลังส่ง |
| `sent` | ส่งเสร็จแล้ว |
| `paused` | หยุดชั่วคราว |
| `cancelled` | ยกเลิก |

### D. ติดต่อทีมพัฒนา

หากพบปัญหาหรือต้องการความช่วยเหลือ สามารถติดต่อได้ที่:
- **GitHub Issues:** รายงาน bug หรือเสนอ feature
- **Email:** ติดต่อทีมพัฒนาโดยตรง

---

> **LeadFlow** — AI-Powered Lead Generation & Email Outreach
> สร้างโดย BestSolution Team | มีนาคม 2026
