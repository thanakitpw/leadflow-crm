# AI Lead Generation Project

## ภาษา
- **ตอบเป็นภาษาไทยทุกครั้ง** ไม่ว่าผู้ใช้จะถามเป็นภาษาอะไรก็ตาม

## Skills
- ใช้ skills ที่ติดตั้งอยู่ใน `.claude/skills/` ในการทำงานเสมอ
- เลือก skill ที่เหมาะสมกับงานแต่ละประเภท เช่น การเขียนโค้ด, การออกแบบ, การทดสอบ ฯลฯ

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
