-- ============================================================
-- Seed Data — Development only
-- Phase 1: Auth & Multi-tenant
--
-- NOTE: Supabase Auth users must be created via the Auth API or
-- Studio before this seed can insert dependent rows.
-- Run `supabase db reset` to apply migrations + this seed.
-- ============================================================

-- ----------------------------------------------------------------
-- Helper: create a fake auth.users row for local dev seeding.
-- In Supabase local, auth.users accepts direct inserts.
-- ----------------------------------------------------------------
DO $$
DECLARE
  v_owner_id       uuid := '00000000-0000-0000-0000-000000000001';
  v_member_id      uuid := '00000000-0000-0000-0000-000000000002';
  v_viewer_id      uuid := '00000000-0000-0000-0000-000000000003';
  v_agency_id      uuid := '00000000-0000-0000-0000-000000000010';
  v_workspace1_id  uuid := '00000000-0000-0000-0000-000000000020';
  v_workspace2_id  uuid := '00000000-0000-0000-0000-000000000021';
BEGIN

  -- ----------------------------------------------------------------
  -- Auth users (local Supabase only)
  -- ----------------------------------------------------------------
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, created_at, updated_at, aud, role
  )
  VALUES
    (v_owner_id,  'admin@leadflow.dev',  crypt('password123', gen_salt('bf')), now(),
     '{"full_name":"Agency Admin"}'::jsonb, now(), now(), 'authenticated', 'authenticated'),
    (v_member_id, 'member@leadflow.dev', crypt('password123', gen_salt('bf')), now(),
     '{"full_name":"Agency Member"}'::jsonb, now(), now(), 'authenticated', 'authenticated'),
    (v_viewer_id, 'viewer@leadflow.dev', crypt('password123', gen_salt('bf')), now(),
     '{"full_name":"Client Viewer"}'::jsonb, now(), now(), 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  -- profiles are auto-created by on_auth_user_created trigger.
  -- If seeding after migration in a clean DB they should already exist.

  -- ----------------------------------------------------------------
  -- Agency
  -- ----------------------------------------------------------------
  INSERT INTO public.agencies (id, name, slug, owner_id)
  VALUES (v_agency_id, 'BestSolution Agency', 'bestsolution', v_owner_id)
  ON CONFLICT (id) DO NOTHING;

  -- ----------------------------------------------------------------
  -- Workspaces
  -- ----------------------------------------------------------------
  INSERT INTO public.workspaces (id, agency_id, name, type)
  VALUES
    (v_workspace1_id, v_agency_id, 'BestSolution (Internal)', 'agency'),
    (v_workspace2_id, v_agency_id, 'Demo Client - Restaurant Chain', 'client')
  ON CONFLICT (id) DO NOTHING;

  -- ----------------------------------------------------------------
  -- Workspace Members
  -- ----------------------------------------------------------------
  INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
  VALUES
    -- Workspace 1 (agency internal)
    (v_workspace1_id, v_owner_id,  'agency_admin',  now()),
    (v_workspace1_id, v_member_id, 'agency_member', now()),

    -- Workspace 2 (client)
    (v_workspace2_id, v_owner_id,  'agency_admin',  now()),
    (v_workspace2_id, v_member_id, 'agency_member', now()),
    (v_workspace2_id, v_viewer_id, 'client_viewer', now())
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- ----------------------------------------------------------------
  -- Sample audit log entries
  -- ----------------------------------------------------------------
  INSERT INTO public.audit_logs (workspace_id, user_id, action, resource_type, metadata)
  VALUES
    (v_workspace1_id, v_owner_id, 'workspace.created', 'workspace',
     '{"workspace_name": "BestSolution (Internal)"}'::jsonb),
    (v_workspace2_id, v_owner_id, 'workspace.created', 'workspace',
     '{"workspace_name": "Demo Client - Restaurant Chain"}'::jsonb),
    (v_workspace2_id, v_owner_id, 'member.invited', 'workspace_member',
     '{"invited_email": "viewer@leadflow.dev", "role": "client_viewer"}'::jsonb)
  ON CONFLICT DO NOTHING;

END $$;
