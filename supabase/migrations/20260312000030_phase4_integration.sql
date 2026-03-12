-- Migration: Phase 4 — Integration Layer (Lead → Email + Dashboard)
-- Tables: client_reports, activity_feed
-- Views:  workspace_stats
-- Depends on Phase 1: workspaces, workspace_members, profiles
-- Depends on Phase 2: leads
-- Depends on Phase 3: campaigns, email_events
-- Helper functions available: is_workspace_member(), workspace_role(), set_updated_at()

-- ============================================================
-- Table: client_reports
-- รายงานที่แชร์ให้ลูกค้าดูผ่าน share_token (public link)
-- expires_at = NULL หมายความว่าลิงก์ไม่มีวันหมดอายุ
-- ============================================================
CREATE TABLE public.client_reports (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  title        text        NOT NULL,

  -- Token สำหรับ public link — สุ่มด้วย gen_random_bytes(32) → hex = 64 chars
  share_token  text        NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- ช่วงวันที่ของรายงาน
  date_from    date        NOT NULL,
  date_to      date        NOT NULL,

  -- config เก็บ settings ของรายงาน เช่น sections ที่ต้องการแสดง
  config       jsonb       NOT NULL DEFAULT '{}',

  -- ผู้สร้าง — SET NULL เมื่อ profile ถูกลบ
  created_by   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- null = ไม่มีวันหมดอายุ
  expires_at   timestamptz,

  CONSTRAINT client_reports_pkey             PRIMARY KEY (id),
  CONSTRAINT client_reports_title_check      CHECK (title <> ''),
  CONSTRAINT client_reports_token_check      CHECK (share_token <> ''),
  CONSTRAINT client_reports_date_order_check CHECK (date_to >= date_from),
  CONSTRAINT client_reports_token_unique     UNIQUE (share_token)
);

-- Trigger: อัพเดท updated_at อัตโนมัติ
CREATE TRIGGER trg_client_reports_updated_at
  BEFORE UPDATE ON public.client_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX idx_client_reports_workspace_id ON public.client_reports (workspace_id);
-- share_token UNIQUE constraint สร้าง implicit index อยู่แล้ว แต่สร้าง explicit index
-- เพื่อให้ชัดเจนว่าใช้สำหรับ public token lookup
CREATE INDEX idx_client_reports_share_token  ON public.client_reports (share_token);
CREATE INDEX idx_client_reports_expires_at   ON public.client_reports (expires_at)
  WHERE expires_at IS NOT NULL;

-- ============================================================
-- RLS: client_reports
-- SELECT / INSERT / UPDATE: workspace members ทุก role
-- DELETE: agency_admin เท่านั้น
-- Public access ผ่าน share_token ใช้ function get_report_by_token()
-- ซึ่ง SECURITY DEFINER — ไม่ต้องเปิด RLS สำหรับ anonymous
-- ============================================================
ALTER TABLE public.client_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_reports_select" ON public.client_reports
  FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "client_reports_insert" ON public.client_reports
  FOR INSERT
  WITH CHECK (
    public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member')
  );

CREATE POLICY "client_reports_update" ON public.client_reports
  FOR UPDATE
  USING  (public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member'))
  WITH CHECK (public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member'));

CREATE POLICY "client_reports_delete" ON public.client_reports
  FOR DELETE
  USING (public.workspace_role(workspace_id) = 'agency_admin');

-- ============================================================
-- Table: activity_feed
-- บันทึก activity ของ team ใน workspace
-- Append-only — ไม่อนุญาต UPDATE หรือ DELETE สำหรับ authenticated users
-- ข้อมูลเก่าลบโดย scheduled job ผ่าน service_role
-- ============================================================
CREATE TABLE public.activity_feed (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- ผู้ทำ action — SET NULL เมื่อ profile ถูกลบ (ยังเก็บ activity history ไว้)
  user_id      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- ประเภทของ action เช่น 'lead_created', 'email_sent', 'campaign_launched', 'lead_scored'
  action       text        NOT NULL,

  -- ประเภทของ entity ที่ถูกกระทำ
  entity_type  text        NOT NULL,

  -- UUID ของ entity (อ้างอิง leads/campaigns/templates/sequences)
  -- ไม่ใช้ FK ตรง เพราะ entity_type หลากหลาย — ตรวจสอบผ่าน application layer แทน
  entity_id    uuid,

  -- metadata เพิ่มเติม เช่น { "score": 85, "previous_status": "new", "new_status": "contacted" }
  metadata     jsonb       NOT NULL DEFAULT '{}',

  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT activity_feed_pkey              PRIMARY KEY (id),
  CONSTRAINT activity_feed_action_check      CHECK (action <> ''),
  CONSTRAINT activity_feed_entity_type_check CHECK (
    entity_type IN ('lead', 'campaign', 'template', 'sequence', 'domain', 'workspace')
  )
);

-- Indexes
-- (workspace_id, created_at DESC) — ใช้สำหรับดึง feed เรียงจากใหม่ไปเก่า
CREATE INDEX idx_activity_feed_workspace_created
  ON public.activity_feed (workspace_id, created_at DESC);

-- (entity_type, entity_id) — ใช้สำหรับดึง history ของ entity เฉพาะ
CREATE INDEX idx_activity_feed_entity
  ON public.activity_feed (entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

-- user_id — ใช้สำหรับดูว่า user คนนี้ทำอะไรไปบ้าง
CREATE INDEX idx_activity_feed_user_id
  ON public.activity_feed (user_id)
  WHERE user_id IS NOT NULL;

-- ============================================================
-- RLS: activity_feed
-- SELECT: workspace members ทุก role
-- INSERT: agency_admin และ agency_member (client_viewer ดูอย่างเดียว)
-- UPDATE / DELETE: ไม่อนุญาต authenticated users (append-only log)
--   service_role ใช้สำหรับ retention cleanup
-- ============================================================
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_feed_select" ON public.activity_feed
  FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "activity_feed_insert" ON public.activity_feed
  FOR INSERT
  WITH CHECK (
    public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member')
  );

-- Append-only: ห้าม UPDATE จาก authenticated sessions
CREATE POLICY "activity_feed_no_update" ON public.activity_feed
  FOR UPDATE
  USING (false);

-- Append-only: ห้าม DELETE จาก authenticated sessions
-- (service_role จัดการ retention ผ่านการ bypass RLS)
CREATE POLICY "activity_feed_no_delete" ON public.activity_feed
  FOR DELETE
  USING (false);

-- ============================================================
-- View: workspace_stats
-- Dashboard stats รวมต่อ workspace
-- เป็น regular view — query แบบ real-time
-- ป้องกันด้วย RLS ของ table ที่อ้างอิง + security_invoker
-- ============================================================
CREATE OR REPLACE VIEW public.workspace_stats
  WITH (security_invoker = true)
AS
SELECT
  w.id AS workspace_id,

  -- Lead stats
  (SELECT COUNT(*)
   FROM public.leads l
   WHERE l.workspace_id = w.id)                                                AS total_leads,

  (SELECT COUNT(*)
   FROM public.leads l
   WHERE l.workspace_id = w.id
     AND l.status = 'new')                                                     AS new_leads,

  (SELECT COUNT(*)
   FROM public.leads l
   WHERE l.workspace_id = w.id
     AND l.email IS NOT NULL)                                                   AS leads_with_email,

  -- Campaign stats
  (SELECT COUNT(*)
   FROM public.campaigns c
   WHERE c.workspace_id = w.id)                                                AS total_campaigns,

  (SELECT COUNT(*)
   FROM public.campaigns c
   WHERE c.workspace_id = w.id
     AND c.status = 'sent')                                                    AS sent_campaigns,

  -- Email event stats — แต่ละ event_type นับแยก
  (SELECT COUNT(*)
   FROM public.email_events ee
   WHERE ee.workspace_id = w.id
     AND ee.event_type = 'sent')                                               AS emails_sent,

  (SELECT COUNT(*)
   FROM public.email_events ee
   WHERE ee.workspace_id = w.id
     AND ee.event_type = 'opened')                                             AS emails_opened,

  (SELECT COUNT(*)
   FROM public.email_events ee
   WHERE ee.workspace_id = w.id
     AND ee.event_type = 'clicked')                                            AS emails_clicked,

  (SELECT COUNT(*)
   FROM public.email_events ee
   WHERE ee.workspace_id = w.id
     AND ee.event_type = 'bounced')                                            AS emails_bounced

FROM public.workspaces w;

-- ============================================================
-- Function: get_report_by_token
-- Public access สำหรับ shareable report link
-- SECURITY DEFINER — รันใน context ของ function owner ข้าม RLS ได้
-- ตรวจสอบ expires_at ก่อนคืนค่า
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_report_by_token(token TEXT)
RETURNS SETOF public.client_reports
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM   public.client_reports
  WHERE  share_token = token
    AND  (expires_at IS NULL OR expires_at > now());
$$;

-- ============================================================
-- Helper: purge activity_feed entries เก่ากว่า N วัน
-- ใช้สำหรับ retention policy — เรียกจาก pg_cron หรือ Edge Function
-- service_role bypass RLS จึงสามารถ DELETE ได้
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_activity_feed(older_than_days INTEGER DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.activity_feed
  WHERE created_at < now() - (older_than_days || ' days')::interval;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
