-- ============================================================
-- pgTAP Test: RLS policies สำหรับ leads, lead_scores, lead_tags
-- ============================================================
-- RLS policies ที่ทดสอบ (จาก migration 20260312000010_create_leads.sql):
--
--   leads:
--     leads_select  → is_workspace_member(workspace_id)
--     leads_insert  → is_workspace_member(workspace_id)
--     leads_update  → is_workspace_member(workspace_id)
--     leads_delete  → workspace_role IN ('agency_admin','agency_member')
--                     (client_viewer ลบไม่ได้)
--
--   lead_scores:
--     lead_scores_select   → lead ต้องอยู่ใน workspace ของตน
--     lead_scores_insert   → WITH CHECK (false) — blocked ทุก authenticated session
--     lead_scores_no_update → USING (false)
--     lead_scores_no_delete → USING (false)
--
--   lead_tags:
--     lead_tags_select → is_workspace_member (ผ่าน parent lead)
--     lead_tags_insert → workspace_role IN ('agency_admin','agency_member')
--     lead_tags_update → workspace_role IN ('agency_admin','agency_member')
--     lead_tags_delete → workspace_role IN ('agency_admin','agency_member')
--
-- Test plan: 30 tests
-- ============================================================

BEGIN;
SELECT plan(30);

-- ============================================================
-- Setup helpers (inline เพื่อ self-contained)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS tests;

CREATE OR REPLACE FUNCTION tests.create_test_user(user_email TEXT)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_id uuid;
BEGIN
  v_id := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
  VALUES (v_id, '00000000-0000-0000-0000-000000000000', user_email,
    crypt('Test1234!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated', now(), now());
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION tests.create_workspace_for(p_owner_id uuid, p_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ag uuid; v_ws uuid;
BEGIN
  INSERT INTO public.agencies (name, slug, owner_id)
  VALUES (p_name || ' Agency', 'ag-' || replace(gen_random_uuid()::text,'-',''), p_owner_id)
  RETURNING id INTO v_ag;
  INSERT INTO public.workspaces (agency_id, name, type)
  VALUES (v_ag, p_name, 'client') RETURNING id INTO v_ws;
  INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
  VALUES (v_ws, p_owner_id, 'agency_admin', now());
  RETURN v_ws;
END; $$;

CREATE OR REPLACE FUNCTION tests.add_member(p_ws uuid, p_uid uuid, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
  VALUES (p_ws, p_uid, p_role, now())
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = p_role;
END; $$;

CREATE OR REPLACE FUNCTION tests.authenticate_as(p_uid uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated', 'aud', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- ============================================================
-- Fixture data (ทุกอย่างถูก ROLLBACK เมื่อจบ transaction)
-- ============================================================

-- User A = admin ของ Workspace A
-- User B = admin ของ Workspace B
-- User C = agency_member ใน Workspace A
-- User D = client_viewer ใน Workspace A

DO $$
DECLARE
  uid_a  uuid; uid_b uuid; uid_c uuid; uid_d uuid;
  ws_a   uuid; ws_b  uuid;
  lead_a uuid; lead_b uuid;
BEGIN
  uid_a := tests.create_test_user('lead_test_user_a@test.internal');
  uid_b := tests.create_test_user('lead_test_user_b@test.internal');
  uid_c := tests.create_test_user('lead_test_user_c@test.internal');
  uid_d := tests.create_test_user('lead_test_user_d@test.internal');

  ws_a  := tests.create_workspace_for(uid_a, 'WS-Alpha');
  ws_b  := tests.create_workspace_for(uid_b, 'WS-Beta');

  PERFORM tests.add_member(ws_a, uid_c, 'agency_member');
  PERFORM tests.add_member(ws_a, uid_d, 'client_viewer');

  -- Leads (service_role context ไม่ต้องผ่าน RLS)
  INSERT INTO public.leads (workspace_id, name, source_type, status)
  VALUES (ws_a, 'Alpha Restaurant', 'manual', 'new') RETURNING id INTO lead_a;

  INSERT INTO public.leads (workspace_id, name, source_type, status)
  VALUES (ws_b, 'Beta Coffee', 'manual', 'new') RETURNING id INTO lead_b;

  -- เก็บ IDs ไว้ใน temp table สำหรับ tests ด้านล่าง
  CREATE TEMP TABLE t_ids (
    uid_a  uuid, uid_b uuid, uid_c uuid, uid_d uuid,
    ws_a   uuid, ws_b  uuid,
    lead_a uuid, lead_b uuid
  ) ON COMMIT DROP;

  INSERT INTO t_ids VALUES (uid_a, uid_b, uid_c, uid_d, ws_a, ws_b, lead_a, lead_b);
END;
$$;

-- ============================================================
-- LEADS — SELECT tests
-- ============================================================

-- Test 1: User A (admin) ต้องเห็น lead ของ Workspace A
SELECT ok(
  (SELECT COUNT(*) = 1
   FROM (
     SELECT tests.authenticate_as((SELECT uid_a FROM t_ids))
   ) auth_step,
   LATERAL (
     SELECT id FROM public.leads WHERE id = (SELECT lead_a FROM t_ids)
   ) q),
  'User A (admin) can SELECT lead in own workspace A'
);

-- Test 2: CRITICAL — User A ต้องไม่เห็น lead ของ Workspace B
SELECT ok(
  (SELECT COUNT(*) = 0
   FROM (
     SELECT tests.authenticate_as((SELECT uid_a FROM t_ids))
   ) auth_step,
   LATERAL (
     SELECT id FROM public.leads WHERE id = (SELECT lead_b FROM t_ids)
   ) q),
  'User A (admin) cannot SELECT lead belonging to workspace B (cross-workspace isolation)'
);

-- Test 3: User B (admin) ต้องไม่เห็น lead ของ Workspace A
SELECT ok(
  (SELECT COUNT(*) = 0
   FROM (
     SELECT tests.authenticate_as((SELECT uid_b FROM t_ids))
   ) auth_step,
   LATERAL (
     SELECT id FROM public.leads WHERE id = (SELECT lead_a FROM t_ids)
   ) q),
  'User B (admin) cannot SELECT lead belonging to workspace A (cross-workspace isolation)'
);

-- Test 4: agency_member เห็น leads ใน workspace ของตน
SELECT ok(
  (SELECT COUNT(*) = 1
   FROM (
     SELECT tests.authenticate_as((SELECT uid_c FROM t_ids))
   ) auth_step,
   LATERAL (
     SELECT id FROM public.leads WHERE id = (SELECT lead_a FROM t_ids)
   ) q),
  'agency_member (User C) can SELECT lead in own workspace'
);

-- Test 5: client_viewer เห็น leads ใน workspace ของตน
SELECT ok(
  (SELECT COUNT(*) = 1
   FROM (
     SELECT tests.authenticate_as((SELECT uid_d FROM t_ids))
   ) auth_step,
   LATERAL (
     SELECT id FROM public.leads WHERE id = (SELECT lead_a FROM t_ids)
   ) q),
  'client_viewer (User D) can SELECT lead in own workspace'
);

-- Test 6: client_viewer ไม่เห็น leads ของ workspace อื่น
SELECT ok(
  (SELECT COUNT(*) = 0
   FROM (
     SELECT tests.authenticate_as((SELECT uid_d FROM t_ids))
   ) auth_step,
   LATERAL (
     SELECT id FROM public.leads WHERE id = (SELECT lead_b FROM t_ids)
   ) q),
  'client_viewer (User D) cannot SELECT lead from another workspace'
);

-- ============================================================
-- LEADS — INSERT tests
-- ============================================================

-- Test 7: User A สามารถ INSERT lead เข้า Workspace A ได้
SELECT lives_ok(
  format($$
    DO $$$ BEGIN
      PERFORM tests.authenticate_as(%L::uuid);
      INSERT INTO public.leads (workspace_id, name, source_type, status)
      VALUES (%L::uuid, 'New Lead by A', 'manual', 'new');
    END; $$$
  $$, (SELECT uid_a FROM t_ids), (SELECT ws_a FROM t_ids)),
  'User A (admin) can INSERT lead into workspace A'
);

-- Test 8: CRITICAL — User A ไม่สามารถ INSERT lead เข้า Workspace B ได้
SELECT throws_ok(
  format($$
    DO $$$ BEGIN
      PERFORM tests.authenticate_as(%L::uuid);
      INSERT INTO public.leads (workspace_id, name, source_type, status)
      VALUES (%L::uuid, 'Malicious Lead', 'manual', 'new');
    END; $$$
  $$, (SELECT uid_a FROM t_ids), (SELECT ws_b FROM t_ids)),
  'new row violates row-level security policy for table "leads"',
  'User A (admin) cannot INSERT lead into workspace B (cross-workspace isolation)'
);

-- Test 9: agency_member สามารถ INSERT lead เข้า workspace ของตนได้
SELECT lives_ok(
  format($$
    DO $$$ BEGIN
      PERFORM tests.authenticate_as(%L::uuid);
      INSERT INTO public.leads (workspace_id, name, source_type, status)
      VALUES (%L::uuid, 'Lead by Member', 'manual', 'new');
    END; $$$
  $$, (SELECT uid_c FROM t_ids), (SELECT ws_a FROM t_ids)),
  'agency_member (User C) can INSERT lead into own workspace'
);

-- Test 10: client_viewer ไม่สามารถ INSERT lead ได้
SELECT throws_ok(
  format($$
    DO $$$ BEGIN
      PERFORM tests.authenticate_as(%L::uuid);
      INSERT INTO public.leads (workspace_id, name, source_type, status)
      VALUES (%L::uuid, 'Viewer Lead', 'manual', 'new');
    END; $$$
  $$, (SELECT uid_d FROM t_ids), (SELECT ws_a FROM t_ids)),
  'new row violates row-level security policy for table "leads"',
  'client_viewer (User D) cannot INSERT lead (blocked by RLS)'
);

-- ============================================================
-- LEADS — UPDATE tests
-- ============================================================

-- Test 11: User A สามารถ UPDATE lead ของ Workspace A ได้
SELECT ok(
  (SELECT COUNT(*) = 1
   FROM (SELECT tests.authenticate_as((SELECT uid_a FROM t_ids))) _,
   LATERAL (
     UPDATE public.leads SET notes = 'Updated by A'
     WHERE id = (SELECT lead_a FROM t_ids) RETURNING id
   ) q),
  'User A (admin) can UPDATE lead in workspace A'
);

-- Test 12: CRITICAL — User A ไม่สามารถ UPDATE lead ของ Workspace B ได้
SELECT ok(
  (SELECT COUNT(*) = 0
   FROM (SELECT tests.authenticate_as((SELECT uid_a FROM t_ids))) _,
   LATERAL (
     UPDATE public.leads SET notes = 'Hijacked by A'
     WHERE id = (SELECT lead_b FROM t_ids) RETURNING id
   ) q),
  'User A (admin) cannot UPDATE lead in workspace B (cross-workspace isolation)'
);

-- Test 13: agency_member สามารถ UPDATE lead ในworkspace ของตนได้
SELECT ok(
  (SELECT COUNT(*) = 1
   FROM (SELECT tests.authenticate_as((SELECT uid_c FROM t_ids))) _,
   LATERAL (
     UPDATE public.leads SET notes = 'Member note'
     WHERE id = (SELECT lead_a FROM t_ids) RETURNING id
   ) q),
  'agency_member (User C) can UPDATE lead in own workspace'
);

-- Test 14: client_viewer ไม่สามารถ UPDATE lead ได้
SELECT ok(
  (SELECT COUNT(*) = 0
   FROM (SELECT tests.authenticate_as((SELECT uid_d FROM t_ids))) _,
   LATERAL (
     UPDATE public.leads SET notes = 'Viewer note'
     WHERE id = (SELECT lead_a FROM t_ids) RETURNING id
   ) q),
  'client_viewer (User D) cannot UPDATE lead (blocked by RLS)'
);

-- ============================================================
-- LEADS — DELETE tests
-- ============================================================

-- เตรียม lead ชั่วคราวสำหรับทดสอบ DELETE
DO $$
DECLARE v_lead_tmp uuid;
BEGIN
  INSERT INTO public.leads (workspace_id, name, source_type, status)
  VALUES ((SELECT ws_a FROM t_ids), 'Tmp Lead for Delete A', 'manual', 'new')
  RETURNING id INTO v_lead_tmp;
  CREATE TEMP TABLE t_tmp_leads (del_lead_a uuid, del_lead_viewer uuid) ON COMMIT DROP;
  INSERT INTO t_tmp_leads VALUES (v_lead_tmp, NULL);

  INSERT INTO public.leads (workspace_id, name, source_type, status)
  VALUES ((SELECT ws_a FROM t_ids), 'Tmp Lead for Viewer Delete Test', 'manual', 'new')
  RETURNING id INTO v_lead_tmp;
  UPDATE t_tmp_leads SET del_lead_viewer = v_lead_tmp;
END;
$$;

-- Test 15: User A (admin) สามารถ DELETE lead ของ Workspace A ได้
SELECT ok(
  (SELECT COUNT(*) = 1
   FROM (SELECT tests.authenticate_as((SELECT uid_a FROM t_ids))) _,
   LATERAL (
     DELETE FROM public.leads WHERE id = (SELECT del_lead_a FROM t_tmp_leads) RETURNING id
   ) q),
  'User A (admin) can DELETE lead in workspace A'
);

-- Test 16: CRITICAL — User A ไม่สามารถ DELETE lead ของ Workspace B ได้
SELECT ok(
  (SELECT COUNT(*) = 0
   FROM (SELECT tests.authenticate_as((SELECT uid_a FROM t_ids))) _,
   LATERAL (
     DELETE FROM public.leads WHERE id = (SELECT lead_b FROM t_ids) RETURNING id
   ) q),
  'User A (admin) cannot DELETE lead in workspace B (cross-workspace isolation)'
);

-- Test 17: client_viewer ไม่สามารถ DELETE lead ได้
SELECT ok(
  (SELECT COUNT(*) = 0
   FROM (SELECT tests.authenticate_as((SELECT uid_d FROM t_ids))) _,
   LATERAL (
     DELETE FROM public.leads WHERE id = (SELECT del_lead_viewer FROM t_tmp_leads) RETURNING id
   ) q),
  'client_viewer (User D) cannot DELETE lead (blocked by workspace_role check)'
);

-- ============================================================
-- LEAD_SCORES — tests
-- Policy: SELECT ผ่าน parent lead's workspace; INSERT/UPDATE/DELETE blocked
-- ============================================================

-- เพิ่ม score ผ่าน service_role (bypass RLS)
DO $$
DECLARE v_score_id uuid;
BEGIN
  INSERT INTO public.lead_scores (lead_id, score, reasoning, model_version)
  VALUES ((SELECT lead_a FROM t_ids), 75, 'Good rating', 'claude-sonnet-4-6')
  RETURNING id INTO v_score_id;
  CREATE TEMP TABLE t_score_ids (score_a uuid) ON COMMIT DROP;
  INSERT INTO t_score_ids VALUES (v_score_id);
END;
$$;

-- Test 18: User A สามารถ SELECT lead_score ที่เป็น lead ของ Workspace A ได้
SELECT ok(
  (SELECT COUNT(*) = 1
   FROM (SELECT tests.authenticate_as((SELECT uid_a FROM t_ids))) _,
   LATERAL (
     SELECT id FROM public.lead_scores WHERE id = (SELECT score_a FROM t_score_ids)
   ) q),
  'User A can SELECT lead_scores for leads in own workspace'
);

-- Test 19: User B ไม่สามารถ SELECT lead_score ของ Workspace A ได้
SELECT ok(
  (SELECT COUNT(*) = 0
   FROM (SELECT tests.authenticate_as((SELECT uid_b FROM t_ids))) _,
   LATERAL (
     SELECT id FROM public.lead_scores WHERE id = (SELECT score_a FROM t_score_ids)
   ) q),
  'User B cannot SELECT lead_scores for leads in workspace A (cross-workspace isolation)'
);

-- Test 20: Authenticated user ไม่สามารถ INSERT lead_score ได้ (blocked by WITH CHECK (false))
SELECT throws_ok(
  format($$
    DO $$$ BEGIN
      PERFORM tests.authenticate_as(%L::uuid);
      INSERT INTO public.lead_scores (lead_id, score, model_version)
      VALUES (%L::uuid, 90, 'claude-sonnet-4-6');
    END; $$$
  $$, (SELECT uid_a FROM t_ids), (SELECT lead_a FROM t_ids)),
  'new row violates row-level security policy for table "lead_scores"',
  'Authenticated user cannot INSERT lead_scores (service_role only)'
);

-- Test 21: ไม่มีใคร UPDATE lead_scores ได้
SELECT ok(
  (SELECT COUNT(*) = 0
   FROM (SELECT tests.authenticate_as((SELECT uid_a FROM t_ids))) _,
   LATERAL (
     UPDATE public.lead_scores SET score = 99
     WHERE id = (SELECT score_a FROM t_score_ids) RETURNING id
   ) q),
  'No authenticated user can UPDATE lead_scores (immutable)'
);

-- Test 22: ไม่มีใคร DELETE lead_scores ได้
SELECT ok(
  (SELECT COUNT(*) = 0
   FROM (SELECT tests.authenticate_as((SELECT uid_a FROM t_ids))) _,
   LATERAL (
     DELETE FROM public.lead_scores WHERE id = (SELECT score_a FROM t_score_ids) RETURNING id
   ) q),
  'No authenticated user can DELETE lead_scores (immutable)'
);

-- ============================================================
-- LEAD_TAGS — tests
-- Policy: SELECT ทุก role; INSERT/UPDATE/DELETE agency_admin + agency_member เท่านั้น
-- ============================================================

-- เพิ่ม tag ผ่าน service_role
DO $$
DECLARE v_tag_id uuid;
BEGIN
  INSERT INTO public.lead_tags (lead_id, tag)
  VALUES ((SELECT lead_a FROM t_ids), 'vip')
  RETURNING id INTO v_tag_id;
  CREATE TEMP TABLE t_tag_ids (tag_a uuid) ON COMMIT DROP;
  INSERT INTO t_tag_ids VALUES (v_tag_id);
END;
$$;

-- Test 23: client_viewer สามารถ SELECT lead_tags ได้
SELECT ok(
  (SELECT COUNT(*) = 1
   FROM (SELECT tests.authenticate_as((SELECT uid_d FROM t_ids))) _,
   LATERAL (
     SELECT id FROM public.lead_tags WHERE id = (SELECT tag_a FROM t_tag_ids)
   ) q),
  'client_viewer (User D) can SELECT lead_tags in own workspace'
);

-- Test 24: User B ไม่สามารถ SELECT lead_tags ของ Workspace A ได้
SELECT ok(
  (SELECT COUNT(*) = 0
   FROM (SELECT tests.authenticate_as((SELECT uid_b FROM t_ids))) _,
   LATERAL (
     SELECT id FROM public.lead_tags WHERE id = (SELECT tag_a FROM t_tag_ids)
   ) q),
  'User B cannot SELECT lead_tags for leads in workspace A (cross-workspace isolation)'
);

-- Test 25: agency_member สามารถ INSERT lead_tag ได้
SELECT lives_ok(
  format($$
    DO $$$ BEGIN
      PERFORM tests.authenticate_as(%L::uuid);
      INSERT INTO public.lead_tags (lead_id, tag) VALUES (%L::uuid, 'prospect');
    END; $$$
  $$, (SELECT uid_c FROM t_ids), (SELECT lead_a FROM t_ids)),
  'agency_member (User C) can INSERT lead_tags'
);

-- Test 26: client_viewer ไม่สามารถ INSERT lead_tag ได้
SELECT throws_ok(
  format($$
    DO $$$ BEGIN
      PERFORM tests.authenticate_as(%L::uuid);
      INSERT INTO public.lead_tags (lead_id, tag) VALUES (%L::uuid, 'viewer-tag');
    END; $$$
  $$, (SELECT uid_d FROM t_ids), (SELECT lead_a FROM t_ids)),
  'new row violates row-level security policy for table "lead_tags"',
  'client_viewer (User D) cannot INSERT lead_tags (blocked by workspace_role check)'
);

-- Test 27: client_viewer ไม่สามารถ DELETE lead_tag ได้
SELECT ok(
  (SELECT COUNT(*) = 0
   FROM (SELECT tests.authenticate_as((SELECT uid_d FROM t_ids))) _,
   LATERAL (
     DELETE FROM public.lead_tags WHERE id = (SELECT tag_a FROM t_tag_ids) RETURNING id
   ) q),
  'client_viewer (User D) cannot DELETE lead_tags'
);

-- Test 28: User A (admin) สามารถ DELETE lead_tag ได้
DO $$
DECLARE v_tag_del uuid;
BEGIN
  INSERT INTO public.lead_tags (lead_id, tag)
  VALUES ((SELECT lead_a FROM t_ids), 'to-be-deleted')
  RETURNING id INTO v_tag_del;
  CREATE TEMP TABLE t_tag_del (id uuid) ON COMMIT DROP;
  INSERT INTO t_tag_del VALUES (v_tag_del);
END;
$$;

SELECT ok(
  (SELECT COUNT(*) = 1
   FROM (SELECT tests.authenticate_as((SELECT uid_a FROM t_ids))) _,
   LATERAL (
     DELETE FROM public.lead_tags WHERE id = (SELECT id FROM t_tag_del) RETURNING id
   ) q),
  'User A (admin) can DELETE lead_tags in own workspace'
);

-- ============================================================
-- PLACES_CACHE — tests
-- Policy: authenticated ทุกคน SELECT ได้; INSERT/UPDATE/DELETE blocked (service_role only)
-- ============================================================

-- เพิ่ม cache entry ผ่าน service_role
DO $$
BEGIN
  INSERT INTO public.places_cache (cache_key, cache_type, results, expires_at)
  VALUES ('test-key-001', 'search', '{"places":[]}'::jsonb, now() + interval '1 hour');
END;
$$;

-- Test 29: User A สามารถ SELECT places_cache ได้
SELECT ok(
  (SELECT COUNT(*) >= 1
   FROM (SELECT tests.authenticate_as((SELECT uid_a FROM t_ids))) _,
   LATERAL (
     SELECT id FROM public.places_cache WHERE cache_key = 'test-key-001'
   ) q),
  'Authenticated user can SELECT places_cache (shared read access)'
);

-- Test 30: Authenticated user ไม่สามารถ INSERT places_cache ได้
SELECT throws_ok(
  format($$
    DO $$$ BEGIN
      PERFORM tests.authenticate_as(%L::uuid);
      INSERT INTO public.places_cache (cache_key, cache_type, results, expires_at)
      VALUES ('inject-key', 'search', '{}'::jsonb, now() + interval '1 hour');
    END; $$$
  $$, (SELECT uid_a FROM t_ids)),
  'new row violates row-level security policy for table "places_cache"',
  'Authenticated user cannot INSERT into places_cache (service_role only)'
);

SELECT * FROM finish();
ROLLBACK;
