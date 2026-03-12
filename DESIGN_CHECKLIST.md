# Design Checklist — LeadFlow CRM
> อัพเดทล่าสุด: 2026-03-12
> เครื่องมือ: Paper (MCP) | Font: Noto Sans Thai | Design reference: Lead List (`10R-0`)

---

## Color Palette (reference)

| Role | Hex | ใช้ที่ |
|------|-----|--------|
| Primary | `#1E3A5F` | Logo, active nav, buttons, badges |
| Canvas | `#F7F5F2` | Background หลัก |
| White | `#FFFFFF` | Sidebar, cards, topbar |
| Ink | `#1C1814` | Text หลัก |
| Muted | `#7A6F68` | Text รอง, nav inactive, labels |
| Border | `#EFE9E2` | Dividers, borders ทั่วไป |
| Border soft | `#E5DDD6` | Search bar, input |
| Active bg | `#EEF2F8` | Nav item active state |
| Row alt | `#FAFBFF` | Table row alternating |

---

## Sidebar Pattern (ทุกหน้าต้องใช้แบบนี้)

```
bg: #FFFFFF
border-right: 1px solid #EFE9E2
width: 210px

Logo area: padding 18px 16px, border-bottom 1px solid #EFE9E2
  └─ Icon: 26x26px, bg #1E3A5F, radius 6px + inner dot 9x9px white
  └─ Text: 15px, font-weight 700, color #1C1814

Nav item (inactive): padding 8px, radius 8px, color #7A6F68, font-size 13px
Nav item (active):   background #EEF2F8, color #1E3A5F, font-weight 600

User section: border-top 1px solid #EFE9E2, padding 12px 16px
```

---

## Screens Status

### ✅ เสร็จแล้ว

| # | Screen | Paper Node | หมายเหตุ |
|---|--------|-----------|---------|
| 1 | Lead List | `10R-0` | Reference design หลัก |
| 2 | Lead Search | `R3-0` | Left filter panel + Right results panel |
| 3 | Campaign List | `29K-0` | Sidebar สีขาว verified |
| 4 | Campaign Detail | `1S5-0` | Sidebar แก้เป็นสีขาวแล้ว |
| 5 | Create Campaign | `1S6-0` | Sidebar แก้เป็นสีขาวแล้ว |
| 6 | Dashboard v2 | `GV-0` | ครบ: stats, chart, lead source, campaign table |
| 7 | Lead Detail | `10S-0` | ครบ: AI score, contact, Google Places, timeline, tasks |
| 8 | Lead Import Export | `10T-0` | ครบ: CSV import + export options |
| 9 | Login | `2G2-0` | Split layout: branding ซ้าย + form ขวา |
| 10 | Design System | `1-0` | Color palette, typography, components reference |
| 11 | Email Template List | `2SC-0` | 4 template cards grid layout |
| 12 | Email Template Editor | `2WW-0` | Edit form + preview split layout |
| 13 | Email Sequence List | `30G-0` | 3 sequence cards พร้อมสถิติ |
| 14 | Sequence Builder | `349-0` | Visual step editor + right panel settings/stats |
| 15 | Domain Settings | `39G-0` | SPF, DKIM, DMARC, MX records + sender reputation |
| 16 | Settings - Profile | `3DG-0` | Profile form + team members list |
| 17 | Billing | `3HB-0` | Pro Plan, usage meters, payment history |
| 18 | Workspace Selection | `3L6-0` | Full-screen workspace cards + create new |
| 19 | Onboarding | `3MQ-0` | Split layout: 3-step progress + domain setup form |

---

### ❌ ยังไม่ได้ทำ (optional/nice-to-have)

- [ ] Unsubscribe List

---

## Priority Queue (ทำตามลำดับ)

```
1. ✅ แก้ Campaign Detail (1S5-0)
2. ✅ แก้ Create Campaign (1S6-0)
3. ✅ Verify Campaign List (29K-0)
4. ✅ Login / Sign Up (2G2-0)
5. ✅ Dashboard / Overview → ใช้ Dashboard v2 (GV-0) ที่มีอยู่แล้ว
6. ✅ Lead Detail → ใช้ (10S-0) ที่มีอยู่แล้ว
7. ✅ Email Template List (2SC-0)
8. ✅ Email Template Editor (2WW-0)
9. ✅ Email Sequence List (30G-0)
10. ✅ Sequence Builder (349-0)
11. ✅ Domain Settings (39G-0)
12. ✅ Settings - Profile & Team (3DG-0)
13. ✅ Billing (3HB-0)
14. ✅ Workspace Selection (3L6-0)
15. ✅ Onboarding (3MQ-0)
```

---

## Progress

```
✅ เสร็จ:        19 screens (รวม Design System)
❌ ยังไม่ทำ:      1 screen (Unsubscribe List — optional)

รวม: 19/20 items (95%)
```
