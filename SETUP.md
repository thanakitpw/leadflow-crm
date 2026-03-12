# Setup Guide — LeadFlow CRM

## Prerequisites

| Tool | Version | ติดตั้ง |
|---|---|---|
| Node.js | 20+ | `brew install node` |
| pnpm | 9+ | `npm install -g pnpm` |
| Python | 3.11+ | `brew install python@3.11` |
| Supabase CLI | latest | `brew install supabase/tap/supabase` |
| Docker | latest | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |

## Quick Start

### 1. Clone & Install

```bash
git clone <repo-url>
cd ai-lead-generation

# คัดลอก env
cp .env.example .env

# ติดตั้ง dependencies
pnpm install
```

### 2. ตั้งค่า Supabase (Local)

```bash
supabase start          # เริ่ม local Supabase (ต้องมี Docker)
supabase db reset       # รัน migrations + seed data
```

จะได้ URL + keys มาใส่ใน `.env`:
- `NEXT_PUBLIC_SUPABASE_URL` → API URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → anon key
- `SUPABASE_SERVICE_ROLE_KEY` → service_role key

### 3. ตั้งค่า Python API

```bash
cd apps/python-api
python -m venv venv
source venv/bin/activate    # macOS/Linux
pip install -r requirements.txt
```

### 4. รันโปรเจค

```bash
# Terminal 1 — Frontend
pnpm dev --filter web

# Terminal 2 — Python API
cd apps/python-api
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 3 — Trigger.dev
pnpm dlx trigger.dev@latest dev
```

เข้า http://localhost:3000

## API Keys ที่ต้องมี

| Key | หาได้จาก | ใช้ทำอะไร |
|---|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/) | Lead scoring, email writing |
| `GOOGLE_PLACES_API_KEY` | [console.cloud.google.com](https://console.cloud.google.com/) | ค้นหาธุรกิจ |
| `RESEND_API_KEY` | [resend.com](https://resend.com/) | ส่งอีเมล |
| `TRIGGER_API_KEY` | [trigger.dev](https://trigger.dev/) | Background jobs |

## Supabase Dashboard

- **Studio**: http://localhost:54323
- **API**: http://localhost:54321
- **DB**: postgresql://postgres:postgres@localhost:54322/postgres
