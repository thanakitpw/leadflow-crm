-- ============================================================
-- Test Setup: Helper functions สำหรับ pgTAP RLS testing
-- ใช้ร่วมกับทุก test file ใน supabase/tests/
--
-- หมายเหตุ: ไฟล์นี้ไม่ได้ run เป็น test ตัวเองตรง ๆ
-- helper functions เหล่านี้ถูก inline ไว้ในแต่ละ test file
-- เพื่อให้แต่ละ file self-contained และรันแยกได้
--
-- วิธีรัน:
--   supabase db reset                   (reset + รัน migrations ทั้งหมด)
--   supabase test db                    (รัน pgTAP tests ทั้งหมด)
-- ============================================================

BEGIN;
SELECT plan(0);

-- ============================================================
-- Schema สำหรับ test helpers
-- ============================================================
CREATE SCHEMA IF NOT EXISTS tests;

-- ============================================================
-- Helper: สร้าง test user ใน auth.users โดยตรง
-- คืนค่า uuid ของ user ที่สร้าง
-- ใช้ service_role context เมื่อเรียก
-- ============================================================
CREATE OR REPLACE FUNCTION tests.create_test_user(
  user_email TEXT DEFAULT 'testuser@example.com'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    user_email,
    crypt('Test1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    'authenticated',
    'authenticated',
    now(),
    now()
  );

  -- handle_new_user trigger จะสร้าง profile อัตโนมัติ
  RETURN v_user_id;
END;
$$;

-- ============================================================
-- Helper: สร้าง agency + workspace + เพิ่ม owner เป็น agency_admin
-- คืนค่า workspace_id
-- ต้องรันใน service_role context (bypass RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION tests.create_test_workspace(
  p_owner_id  uuid,
  p_ws_name   TEXT DEFAULT 'Test Workspace',
  p_ws_type   TEXT DEFAULT 'client'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id    uuid;
  v_ws_id        uuid;
  v_agency_slug  text;
BEGIN
  -- slug ต้องไม่ซ้ำ — ใช้ timestamp + random
  v_agency_slug := 'agency-' || replace(gen_random_uuid()::text, '-', '');

  -- สร้าง agency (owner_id จะตรงกับ profile ของ p_owner_id)
  INSERT INTO public.agencies (name, slug, owner_id)
  VALUES ('Test Agency for ' || p_ws_name, v_agency_slug, p_owner_id)
  RETURNING id INTO v_agency_id;

  -- สร้าง workspace
  INSERT INTO public.workspaces (agency_id, name, type)
  VALUES (v_agency_id, p_ws_name, p_ws_type)
  RETURNING id INTO v_ws_id;

  -- เพิ่ม owner เป็น agency_admin
  INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
  VALUES (v_ws_id, p_owner_id, 'agency_admin', now());

  RETURN v_ws_id;
END;
$$;

-- ============================================================
-- Helper: เพิ่ม member เข้า workspace ด้วย role ที่กำหนด
-- ============================================================
CREATE OR REPLACE FUNCTION tests.add_workspace_member(
  p_workspace_id  uuid,
  p_user_id       uuid,
  p_role          text DEFAULT 'agency_member'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
  VALUES (p_workspace_id, p_user_id, p_role, now())
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = p_role;
END;
$$;

-- ============================================================
-- Helper: Simulate ว่า authenticated user คือ user_id นี้
-- ใช้ก่อน query ที่ต้องการทดสอบ RLS
--
-- หมายเหตุ:
--   set_config(..., true) = local = reset เมื่อ transaction สิ้นสุด
--   ต้องอยู่ใน transaction เดียวกับ query ที่ทดสอบ
-- ============================================================
CREATE OR REPLACE FUNCTION tests.authenticate_as(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Supabase RLS ใช้ request.jwt.claim.sub สำหรับ auth.uid()
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub',  p_user_id::text,
    'role', 'authenticated',
    'aud',  'authenticated'
  )::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('role', 'authenticated', true);
END;
$$;

-- ============================================================
-- Helper: Simulate anonymous user (ไม่ได้ login)
-- ============================================================
CREATE OR REPLACE FUNCTION tests.authenticate_as_anon()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{}', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('role', 'anon', true);
END;
$$;

-- ============================================================
-- Helper: Simulate service_role (bypass RLS ทุก table)
-- ============================================================
CREATE OR REPLACE FUNCTION tests.authenticate_as_service_role()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{}', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('role', 'service_role', true);
END;
$$;

-- ============================================================
-- Helper: สร้าง lead ใน workspace โดยใช้ service_role (bypass RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION tests.create_test_lead(
  p_workspace_id  uuid,
  p_name          text DEFAULT 'Test Lead Co.'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
BEGIN
  INSERT INTO public.leads (workspace_id, name, source_type, status)
  VALUES (p_workspace_id, p_name, 'manual', 'new')
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$$;

-- ============================================================
-- Helper: สร้าง email_template ใน workspace
-- ============================================================
CREATE OR REPLACE FUNCTION tests.create_test_template(
  p_workspace_id  uuid,
  p_name          text DEFAULT 'Test Template'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tmpl_id uuid;
BEGIN
  INSERT INTO public.email_templates (workspace_id, name, subject, body_html)
  VALUES (p_workspace_id, p_name, 'Test Subject', '<p>Hello</p>')
  RETURNING id INTO v_tmpl_id;

  RETURN v_tmpl_id;
END;
$$;

SELECT * FROM finish();
ROLLBACK;
