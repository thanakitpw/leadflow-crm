-- ============================================================
-- pgTAP Test: RLS policies สำหรับ campaigns, campaign_contacts, email_events, unsubscribes
-- ============================================================
-- RLS policies ที่ทดสอบ (จาก migration 20260312000020_create_email_outreach.sql):
--
--   campaigns:
--     campaigns_select → is_workspace_member(workspace_id)
--     campaigns_insert → workspace_role IN ('agency_admin','agency_member')
--     campaigns_update → workspace_role IN ('agency_admin','agency_member')
--     campaigns_delete → workspace_role = 'agency_admin'
--
--   campaign_contacts:
--     campaign_contacts_select → campaign ต้องอยู่ใน workspace ของ user
--     campaign_contacts_insert → WITH CHECK (false) — service_role only
--     campaign_contacts_update → USING (false)       — service_role only
--     campaign_contacts_delete → agency_admin ผ่าน parent campaign
--
--   email_events:
--     email_events_select    → is_workspace_member(workspace_id)
--     email_events_insert    → WITH CHECK (false) — service_role only
--     email_events_no_update → USING (false)
--     email_events_no_delete → USING (false)
--
--   unsubscribes:
--     unsubscribes_select → is_workspace_member(workspace_id)
--     unsubscribes_insert → workspace_role = 'agency_admin'
--     unsubscribes_update → workspace_role = 'agency_admin'
--     unsubscribes_delete → workspace_role = 'agency_admin'
--
-- Test plan: 28 tests
-- ============================================================

BEGIN;
SELECT plan(28);

-- ============================================================
-- Setup helpers (inline)
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
-- Fixture data
-- ============================================================
-- User A = admin ของ Workspace A
-- User B = admin ของ Workspace B (workspace แยก)
-- User C = agency_member ใน Workspace A
-- User D = client_viewer ใน Workspace A

DO $$
DECLARE
  uid_a  uuid; uid_b uuid; uid_c uuid; uid_d uuid;
  ws_a   uuid; ws_b  uuid;
  lead_a uuid;
  tmpl_a uuid;
  camp_a uuid; camp_b uuid;
  cc_a   uuid;
  ev_a   uuid;
BEGIN
  uid_a := tests.create_test_user('camp_test_a@test.internal');
  uid_b := tests.create_test_user('camp_test_b@test.internal');
  uid_c := tests.create_test_user('camp_test_c@test.internal');
  uid_d := tests.create_test_user('camp_test_d@test.internal');

  ws_a  := tests.create_workspace_for(uid_a, 'CampWS-Alpha');
  ws_b  := tests.create_workspace_for(uid_b, 'CampWS-Beta');

  PERFORM tests.add_member(ws_a, uid_c, 'agency_member');
  PERFORM tests.add_member(ws_a, uid_d, 'client_viewer');

  -- เตรียม lead + template + campaign (service_role bypass RLS)
  INSERT INTO public.leads (workspace_id, name, source_type, status)
  VALUES (ws_a, 'Camp Lead A', 'manual', 'new') RETURNING id INTO lead_a;

  INSERT INTO public.email_templates (workspace_id, name, subject, body_html)
  VALUES (ws_a, 'Tmpl A', 'Hello', '<p>Hi</p>') RETURNING id INTO tmpl_a;

  INSERT INTO public.campaigns (workspace_id, name, template_id, status)
  VALUES (ws_a, 'Campaign Alpha', tmpl_a, 'draft') RETURNING id INTO camp_a;

  -- Campaign ใน Workspace B
  DECLARE tmpl_b uuid;
  BEGIN
    INSERT INTO public.email_templates (workspace_id, name, subject, body_html)
    VALUES (ws_b, 'Tmpl B', 'Hello B', '<p>Hi B</p>') RETURNING id INTO tmpl_b;
    INSERT INTO public.campaigns (workspace_id, name, template_id, status)
    VALUES (ws_b, 'Campaign Beta', tmpl_b, 'draft') RETURNING id INTO camp_b;
  END;

  -- campaign_contact (service_role)
  INSERT INTO public.campaign_contacts (campaign_id, lead_id, status)
  VALUES (camp_a, lead_a, 'pending') RETURNING id INTO cc_a;

  -- email_event (service_role)
  INSERT INTO public.email_events (workspace_id, lead_id, campaign_id, event_type)
  VALUES (ws_a, lead_a, camp_a, 'sent') RETURNING id INTO ev_a;

  CREATE TEMP TABLE t_camp (
    uid_a uuid, uid_b uuid, uid_c uuid, uid_d uuid,
    ws_a  uuid, ws_b  uuid,
    lead_a uuid, tmpl_a uuid,
    camp_a uuid, camp_b uuid,
    cc_a   uuid, ev_a   uuid
  ) ON COMMIT DROP;
  INSERT INTO t_camp VALUES (uid_a, uid_b, uid_c, uid_d, ws_a, ws_b,
                             lead_a, tmpl_a, camp_a, camp_b, cc_a, ev_a);
END;
$$;

-- ============================================================
-- CAMPAIGNS — SELECT tests
-- ============================================================

-- Test 1: User A เห็น campaign ของ Workspace A
SELECT ok(
  (SELECT COUNT(*) = 1 FROM (SELECT tests.authenticate_as((SELECT uid_a FROM t_camp))) _,
   LATERAL (SELECT id FROM public.campaigns WHERE id = (SELECT camp_a FROM t_camp)) q),
  'User A (admin) can SELECT campaign in workspace A'
);

-- Test 2: CRITICAL — User A ไม่เห็น campaign ของ Workspace B
SELECT ok(
  (SELECT COUNT(*) = 0 FROM (SELECT tests.authenticate_as((SELECT uid_a FROM t_camp))) _,
   LATERAL (SELECT id FROM public.campaigns WHERE id = (SELECT camp_b FROM t_camp)) q),
  'User A (admin) cannot SELECT campaign in workspace B (cross-workspace isolation)'
);

-- Test 3: client_viewer เห็น campaigns ใน workspace ของตน
SELECT ok(
  (SELECT COUNT(*) = 1 FROM (SELECT tests.authenticate_as((SELECT uid_d FROM t_camp))) _,
   LATERAL (SELECT id FROM public.campaigns WHERE id = (SELECT camp_a FROM t_camp)) q),
  'client_viewer (User D) can SELECT campaign in own workspace'
);

-- ============================================================
-- CAMPAIGNS — INSERT tests
-- ============================================================

-- Test 4: agency_member สามารถสร้าง campaign ได้
SELECT lives_ok(
  format($$
    DO $$$ BEGIN
      PERFORM tests.authenticate_as(%L::uuid);
      INSERT INTO public.campaigns (workspace_id, name, template_id, status)
      VALUES (%L::uuid, 'Member Campaign', %L::uuid, 'draft');
    END; $$$
  $$, (SELECT uid_c FROM t_camp), (SELECT ws_a FROM t_camp), (SELECT tmpl_a FROM t_camp)),
  'agency_member (User C) can INSERT campaign in own workspace'
);

-- Test 5: client_viewer ไม่สามารถสร้าง campaign ได้
SELECT throws_ok(
  format($$
    DO $$$ BEGIN
      PERFORM tests.authenticate_as(%L::uuid);
      INSERT INTO public.campaigns (workspace_id, name, template_id, status)
      VALUES (%L::uuid, 'Viewer Campaign', %L::uuid, 'draft');
    END; $$$
  $$, (SELECT uid_d FROM t_camp), (SELECT ws_a FROM t_camp), (SELECT tmpl_a FROM t_camp)),
  'new row violates row-level security policy for table "campaigns"',
  'client_viewer (User D) cannot INSERT campaign (blocked by workspace_role check)'
);

-- Test 6: User A ไม่สามารถ INSERT campaign เข้า Workspace B ได้
SELECT throws_ok(
  format($$
    DO $$$ BEGIN
      PERFORM tests.authenticate_as(%L::uuid);
      DECLARE tmpl_b uuid;
      BEGIN
        SELECT tmpl_a INTO tmpl_b FROM t_camp; -- ใช้ template ของ ws_a ก็จะ fail ที่ FK/RLS อยู่ดี
        INSERT INTO public.campaigns (workspace_id, name, template_id, status)
        VALUES (%L::uuid, 'Cross Campaign', tmpl_b, 'draft');
      END;
    END; $$$
  $$, (SELECT uid_a FROM t_camp), (SELECT ws_b FROM t_camp)),
  'new row violates row-level security policy for table "campaigns"',
  'User A cannot INSERT campaign into workspace B (cross-workspace isolation)'
);

-- ============================================================
-- CAMPAIGNS — UPDATE tests
-- ============================================================

-- Test 7: User A สามารถ UPDATE campaign ของตนได้
SELECT ok(
  (SELECT COUNT(*) = 1
   FROM (SELECT tests.authenticate_as((SELECT uid_a FROM t_camp))) _,
   LATERAL (
     UPDATE public.campaigns SET name = 'Campaign Alpha Updated'
     WHERE id = (SELECT camp_a FROM t_camp) RETURNING id
   ) q),
  'User A (admin) can UPDATE campaign in workspace A'
);

-- Test 8: CRITICAL — User A ไม่สามารถ UPDATE campaign ของ Workspace B ได้
SELECT ok(
  (SELECT COUNT(*) = 0
   FROM (SELECT tests.authenticate_as((SELECT uid_a FROM t_camp))) _,
   LATERAL (
     UPDATE public.campaigns SET name = 'Hijacked'
     WHERE id = (SELECT camp_b FROM t_camp) RETURNING id
   ) q),
  'User A (admin) cannot UPDATE campaign in workspace B (cross-workspace isolation)'
);

-- ============================================================
-- CAMPAIGNS — DELETE tests
-- ============================================================

DO $$
DECLARE v_camp_del uuid;
BEGIN
  INSERT INTO public.campaigns (workspace_id, name, template_id, status)
  VALUES ((SELECT ws_a FROM t_camp), 'Camp To Delete', (SELECT tmpl_a FROM t_camp), 'draft')
  RETURNING id INTO v_camp_del;
  CREATE TEMP TABLE t_camp_del (id uuid) ON COMMIT DROP;
  INSERT INTO t_camp_del VALUES (v_camp_del);
END;
$$;

-- Test 9: admin สามารถ DELETE campaign ของตนได้
SELECT ok(
  (SELECT COUNT(*) = 1
   FROM (SELECT tests.authenticate_as((SELECT uid_a FROM t_camp))) _,
   LATERAL (DELETE FROM public.campaigns WHERE id = (SELECT id FROM t_camp_del) RETURNING id) q),
  'User A (admin) can DELETE campaign in workspace A'
);

-- Test 10: agency_member ไม่สามารถ DELETE campaign ได้
DO $$
DECLARE v_camp_member uuid;
BEGIN
  INSERT INTO public.campaigns (workspace_id, name, template_id, status)
  VALUES ((SELECT ws_a FROM t_camp), 'Camp Member Cannot Delete', (SELECT tmpl_a FROM t_camp), 'draft')
  RETURNING id INTO v_camp_member;
  CREATE TEMP TABLE t_camp_member_del (id uuid) ON COMMIT DROP;
  INSERT INTO t_camp_member_del VALUES (v_camp_member);
END;
$$;

SELECT ok(
  (SELECT COUNT(*) = 0
   FROM (SELECT tests.authenticate_as((SELECT uid_c FROM t_camp))) _,
   LATERAL (DELETE FROM public.campaigns WHERE id = (SELECT id FROM t_camp_member_del) RETURNING id) q),
  'agency_member (User C) cannot DELETE campaign (admin only)'
);

-- ============================================================
-- CAMPAIGN_CONTACTS — tests
-- ============================================================

-- Test 11: User A เห็น campaign_contacts ของ campaign ใน workspace ของตน
SELECT ok(
  (SELECT COUNT(*) = 1 FROM (SELECT tests.authenticate_as((SELECT uid_a FROM t_camp))) _,
   LATERAL (SELECT id FROM public.campaign_contacts WHERE id = (SELECT cc_a FROM t_camp)) q),
  'User A can SELECT campaign_contacts for campaign in own workspace'
);

-- Test 12: User B ไม่เห็น campaign_contacts ของ Workspace A
SELECT ok(
  (SELECT COUNT(*) = 0 FROM (SELECT tests.authenticate_as((SELECT uid_b FROM t_camp))) _,
   LATERAL (SELECT id FROM public.campaign_contacts WHERE id = (SELECT cc_a FROM t_camp)) q),
  'User B cannot SELECT campaign_contacts from workspace A (cross-workspace isolation)'
);

-- Test 13: Authenticated user ไม่สามารถ INSERT campaign_contacts ได้ (service_role only)
SELECT throws_ok(
  format($$
    DO $$$ BEGIN
      PERFORM tests.authenticate_as(%L::uuid);
      INSERT INTO public.campaign_contacts (campaign_id, lead_id, status)
      VALUES (%L::uuid, %L::uuid, 'pending');
    END; $$$
  $$, (SELECT uid_a FROM t_camp), (SELECT camp_a FROM t_camp), (SELECT lead_a FROM t_camp)),
  'new row violates row-level security policy for table "campaign_contacts"',
  'Authenticated user cannot INSERT campaign_contacts (service_role only)'
);

-- Test 14: Authenticated user ไม่สามารถ UPDATE campaign_contacts ได้
SELECT ok(
  (SELECT COUNT(*) = 0
   FROM (SELECT tests.authenticate_as((SELECT uid_a FROM t_camp))) _,
   LATERAL (
     UPDATE public.campaign_contacts SET status = 'sent'
     WHERE id = (SELECT cc_a FROM t_camp) RETURNING id
   ) q),
  'Authenticated user cannot UPDATE campaign_contacts (service_role only)'
);

-- Test 15: admin สามารถ DELETE campaign_contacts ได้
DO $$
DECLARE v_lead_del uuid; v_cc_del uuid;
BEGIN
  INSERT INTO public.leads (workspace_id, name, source_type, status)
  VALUES ((SELECT ws_a FROM t_camp), 'Lead for CC Delete', 'manual', 'new')
  RETURNING id INTO v_lead_del;
  INSERT INTO public.campaign_contacts (campaign_id, lead_id, status)
  VALUES ((SELECT camp_a FROM t_camp), v_lead_del, 'pending')
  RETURNING id INTO v_cc_del;
  CREATE TEMP TABLE t_cc_del (id uuid) ON COMMIT DROP;
  INSERT INTO t_cc_del VALUES (v_cc_del);
END;
$$;

SELECT ok(
  (SELECT COUNT(*) = 1
   FROM (SELECT tests.authenticate_as((SELECT uid_a FROM t_camp))) _,
   LATERAL (DELETE FROM public.campaign_contacts WHERE id = (SELECT id FROM t_cc_del) RETURNING id) q),
  'User A (admin) can DELETE campaign_contacts in own workspace'
);

-- Test 16: agency_member ไม่สามารถ DELETE campaign_contacts ได้
DO $$
DECLARE v_lead_del2 uuid; v_cc_del2 uuid;
BEGIN
  INSERT INTO public.leads (workspace_id, name, source_type, status)
  VALUES ((SELECT ws_a FROM t_camp), 'Lead for CC Delete 2', 'manual', 'new')
  RETURNING id INTO v_lead_del2;
  INSERT INTO public.campaign_contacts (campaign_id, lead_id, status)
  VALUES ((SELECT camp_a FROM t_camp), v_lead_del2, 'pending')
  RETURNING id INTO v_cc_del2;
  CREATE TEMP TABLE t_cc_del2 (id uuid) ON COMMIT DROP;
  INSERT INTO t_cc_del2 VALUES (v_cc_del2);
END;
$$;

SELECT ok(
  (SELECT COUNT(*) = 0
   FROM (SELECT tests.authenticate_as((SELECT uid_c FROM t_camp))) _,
   LATERAL (DELETE FROM public.campaign_contacts WHERE id = (SELECT id FROM t_cc_del2) RETURNING id) q),
  'agency_member (User C) cannot DELETE campaign_contacts (admin only)'
);

-- ============================================================
-- EMAIL_EVENTS — tests (append-only)
-- ============================================================

-- Test 17: User A เห็น email_events ของ workspace ของตน
SELECT ok(
  (SELECT COUNT(*) = 1 FROM (SELECT tests.authenticate_as((SELECT uid_a FROM t_camp))) _,
   LATERAL (SELECT id FROM public.email_events WHERE id = (SELECT ev_a FROM t_camp)) q),
  'User A can SELECT email_events in own workspace'
);

-- Test 18: User B ไม่เห็น email_events ของ Workspace A
SELECT ok(
  (SELECT COUNT(*) = 0 FROM (SELECT tests.authenticate_as((SELECT uid_b FROM t_camp))) _,
   LATERAL (SELECT id FROM public.email_events WHERE id = (SELECT ev_a FROM t_camp)) q),
  'User B cannot SELECT email_events from workspace A (cross-workspace isolation)'
);

-- Test 19: client_viewer เห็น email_events ของ workspace ของตน
SELECT ok(
  (SELECT COUNT(*) = 1 FROM (SELECT tests.authenticate_as((SELECT uid_d FROM t_camp))) _,
   LATERAL (SELECT id FROM public.email_events WHERE id = (SELECT ev_a FROM t_camp)) q),
  'client_viewer can SELECT email_events in own workspace'
);

-- Test 20: Authenticated user ไม่สามารถ INSERT email_events ได้ (service_role only)
SELECT throws_ok(
  format($$
    DO $$$ BEGIN
      PERFORM tests.authenticate_as(%L::uuid);
      INSERT INTO public.email_events (workspace_id, event_type)
      VALUES (%L::uuid, 'sent');
    END; $$$
  $$, (SELECT uid_a FROM t_camp), (SELECT ws_a FROM t_camp)),
  'new row violates row-level security policy for table "email_events"',
  'Authenticated user cannot INSERT email_events (service_role only)'
);

-- Test 21: ไม่มีใคร UPDATE email_events ได้ (append-only)
SELECT ok(
  (SELECT COUNT(*) = 0
   FROM (SELECT tests.authenticate_as((SELECT uid_a FROM t_camp))) _,
   LATERAL (
     UPDATE public.email_events SET event_type = 'clicked'
     WHERE id = (SELECT ev_a FROM t_camp) RETURNING id
   ) q),
  'No authenticated user can UPDATE email_events (append-only)'
);

-- Test 22: ไม่มีใคร DELETE email_events ได้ (append-only)
SELECT ok(
  (SELECT COUNT(*) = 0
   FROM (SELECT tests.authenticate_as((SELECT uid_a FROM t_camp))) _,
   LATERAL (DELETE FROM public.email_events WHERE id = (SELECT ev_a FROM t_camp) RETURNING id) q),
  'No authenticated user can DELETE email_events (append-only)'
);

-- ============================================================
-- UNSUBSCRIBES — tests
-- policy: SELECT ทุก role; INSERT/UPDATE/DELETE agency_admin only
-- ============================================================

-- สร้าง unsubscribe entry ผ่าน service_role
DO $$
DECLARE v_unsub uuid;
BEGIN
  INSERT INTO public.unsubscribes (workspace_id, email)
  VALUES ((SELECT ws_a FROM t_camp), 'unsub-test@example.com')
  RETURNING id INTO v_unsub;
  CREATE TEMP TABLE t_unsub (id uuid) ON COMMIT DROP;
  INSERT INTO t_unsub VALUES (v_unsub);
END;
$$;

-- Test 23: agency_member เห็น unsubscribes
SELECT ok(
  (SELECT COUNT(*) = 1 FROM (SELECT tests.authenticate_as((SELECT uid_c FROM t_camp))) _,
   LATERAL (SELECT id FROM public.unsubscribes WHERE id = (SELECT id FROM t_unsub)) q),
  'agency_member can SELECT unsubscribes in own workspace'
);

-- Test 24: client_viewer เห็น unsubscribes
SELECT ok(
  (SELECT COUNT(*) = 1 FROM (SELECT tests.authenticate_as((SELECT uid_d FROM t_camp))) _,
   LATERAL (SELECT id FROM public.unsubscribes WHERE id = (SELECT id FROM t_unsub)) q),
  'client_viewer can SELECT unsubscribes in own workspace'
);

-- Test 25: User B ไม่เห็น unsubscribes ของ Workspace A
SELECT ok(
  (SELECT COUNT(*) = 0 FROM (SELECT tests.authenticate_as((SELECT uid_b FROM t_camp))) _,
   LATERAL (SELECT id FROM public.unsubscribes WHERE id = (SELECT id FROM t_unsub)) q),
  'User B cannot SELECT unsubscribes from workspace A (cross-workspace isolation)'
);

-- Test 26: admin สามารถ INSERT unsubscribes ได้
SELECT lives_ok(
  format($$
    DO $$$ BEGIN
      PERFORM tests.authenticate_as(%L::uuid);
      INSERT INTO public.unsubscribes (workspace_id, email) VALUES (%L::uuid, 'admin-added@example.com');
    END; $$$
  $$, (SELECT uid_a FROM t_camp), (SELECT ws_a FROM t_camp)),
  'User A (admin) can INSERT unsubscribes'
);

-- Test 27: agency_member ไม่สามารถ INSERT unsubscribes ได้
SELECT throws_ok(
  format($$
    DO $$$ BEGIN
      PERFORM tests.authenticate_as(%L::uuid);
      INSERT INTO public.unsubscribes (workspace_id, email) VALUES (%L::uuid, 'member-added@example.com');
    END; $$$
  $$, (SELECT uid_c FROM t_camp), (SELECT ws_a FROM t_camp)),
  'new row violates row-level security policy for table "unsubscribes"',
  'agency_member cannot INSERT unsubscribes (admin only)'
);

-- Test 28: agency_member ไม่สามารถ DELETE unsubscribes ได้
SELECT ok(
  (SELECT COUNT(*) = 0
   FROM (SELECT tests.authenticate_as((SELECT uid_c FROM t_camp))) _,
   LATERAL (DELETE FROM public.unsubscribes WHERE id = (SELECT id FROM t_unsub) RETURNING id) q),
  'agency_member cannot DELETE unsubscribes (admin only)'
);

SELECT * FROM finish();
ROLLBACK;
