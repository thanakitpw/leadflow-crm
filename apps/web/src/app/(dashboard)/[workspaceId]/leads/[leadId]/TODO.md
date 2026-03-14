# Lead Detail — Mock / Placeholder / Coming Soon

รายการฟีเจอร์ที่แสดง UI แล้วแต่ยังไม่ทำงานจริง กลับมาทำทีหลัง

---

## 1. งานที่ต้องทำ (Tasks Checklist)
**ไฟล์:** `lead-detail-client.tsx` บรรทัด ~74-87, ~164, ~515-560
**สถานะ:** Mock data — hardcoded 3 tasks, toggle ได้แต่ไม่บันทึกลง DB
**ต้องทำ:**
- สร้าง `lead_tasks` table ใน Supabase (id, lead_id, workspace_id, label, done, order, created_at)
- สร้าง tRPC router: `task.list`, `task.create`, `task.update`, `task.delete`
- เชื่อม UI กับ DB จริง
- ปุ่ม "+ เพิ่ม" ตอนนี้แสดง toast "ฟีเจอร์เพิ่มงานจะพร้อมใช้เร็ว ๆ นี้"

## 2. Assign ให้ Workspace
**ไฟล์:** `lead-detail-client.tsx` บรรทัด ~495-515
**สถานะ:** แสดง UI placeholder "ฟีเจอร์นี้จะพร้อมใช้เร็ว ๆ นี้"
**ต้องทำ:**
- สร้าง `lead_assignments` table (lead_id, target_workspace_id, assigned_by, assigned_at)
- Dropdown เลือก client workspace
- แสดง workspace ที่ assign แล้วพร้อม checkmark
- Copy lead data ไป workspace ปลายทาง

## 3. AI Scoring (ให้คะแนน AI ใหม่)
**ไฟล์:** `lead-detail-client.tsx` บรรทัด ~570-580
**สถานะ:** ปุ่มกดได้แต่แสดง toast "ฟีเจอร์ AI Scoring จะพร้อมใช้เร็ว ๆ นี้"
**ต้องทำ:**
- เชื่อมปุ่มกับ Python API `POST /api/v1/scoring/score` (endpoint มีอยู่แล้ว)
- อัพเดท lead_scores table
- Refresh AI Score card หลัง score เสร็จ
- ต้องมี `ANTHROPIC_API_KEY` ที่ใช้ได้

## 4. Social Media (Facebook Page / Line OA)
**ไฟล์:** `page.tsx` บรรทัด ~486-545
**สถานะ:** Hardcoded "พบแล้ว" / "ไม่พบ" — ไม่ได้ตรวจจริง
**ต้องทำ:**
- Scrape/check Facebook Page จาก website URL
- Check LINE OA
- บันทึกผลลง DB (อาจเป็น field ใน leads table หรือ table แยก)
- อัพเดท badge ตามผลจริง

## 5. Google Places — ระดับราคา (Price Level)
**ไฟล์:** `page.tsx` บรรทัด ~470-481
**สถานะ:** Hardcoded "$$" — ไม่ได้ดึงจาก API จริง
**ต้องทำ:**
- เพิ่ม `price_level` field ใน leads table
- ดึงจาก Places API Details (field: `priceLevel`)
- แสดงตามค่าจริง ($, $$, $$$, $$$$)

## 6. Header Action Buttons
**ไฟล์:** `page.tsx` บรรทัด header area
**สถานะ:**
- "ส่งอีเมล" — ยังไม่เชื่อมกับ campaign/sequence
- "Export" — ยังไม่ทำ (export single lead as PDF/CSV)
- "Assign Workspace" — เชื่อมกับ #2 ด้านบน
**ต้องทำ:**
- ส่งอีเมล → เปิด dialog compose email ด้วย template
- Export → generate PDF report หรือ CSV ของ lead เดียว

## 7. Activity Timeline — Base Events
**ไฟล์:** `lead-detail-client.tsx` บรรทัด ~790-840
**สถานะ:** Mock "นำเข้าจาก Google Places" + "AI Enrichment เสร็จสิ้น" events
**ต้องทำ:**
- บันทึก activity จริงลง `activity_feed` table เมื่อ:
  - Lead ถูกสร้าง (import/search)
  - Email enrichment สำเร็จ
  - AI Score เสร็จ
  - Status เปลี่ยน
  - Assign workspace
- ดึง activity จาก DB แทน mock

---

## สรุป Priority

| # | ฟีเจอร์ | ความยากง่าย | Priority |
|---|---------|------------|----------|
| 3 | AI Scoring | ง่าย (API มีแล้ว) | สูง |
| 7 | Activity Timeline จริง | ปานกลาง | สูง |
| 1 | Tasks Checklist | ปานกลาง (ต้องสร้าง table) | กลาง |
| 5 | Price Level | ง่าย (เพิ่ม field) | กลาง |
| 2 | Assign Workspace | ซับซ้อน | ต่ำ (ทำทีหลัง) |
| 4 | Social Media | ซับซ้อน (scraping) | ต่ำ |
| 6 | Header Actions | ปานกลาง | ต่ำ |
