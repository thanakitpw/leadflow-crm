-- Migration: Create workspace_members table + helper functions
-- Phase 1: Auth & Multi-tenant

-- ============================================================
-- Helper functions (used by RLS across multiple tables)
-- ============================================================

-- Returns TRUE if the calling user belongs to a workspace
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.workspace_members
    WHERE  workspace_id = p_workspace_id
      AND  user_id      = auth.uid()
  );
$$;

-- Returns TRUE if the calling user is agency_admin in a workspace
CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.workspace_members
    WHERE  workspace_id = p_workspace_id
      AND  user_id      = auth.uid()
      AND  role         = 'agency_admin'
  );
$$;

-- Returns the role of the calling user in a workspace (NULL if not member)
CREATE OR REPLACE FUNCTION public.workspace_role(p_workspace_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM   public.workspace_members
  WHERE  workspace_id = p_workspace_id
    AND  user_id      = auth.uid()
  LIMIT 1;
$$;

-- ============================================================
-- Table: workspace_members
-- ============================================================
CREATE TABLE public.workspace_members (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  workspace_id   uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  role           text        NOT NULL DEFAULT 'agency_member',
  invited_email  text,
  invited_at     timestamptz,
  joined_at      timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT workspace_members_pkey              PRIMARY KEY (id),
  CONSTRAINT workspace_members_unique_user       UNIQUE (workspace_id, user_id),
  CONSTRAINT workspace_members_role_check        CHECK (role IN ('agency_admin', 'agency_member', 'client_viewer')),
  CONSTRAINT workspace_members_identity_check    CHECK (
    user_id IS NOT NULL OR invited_email IS NOT NULL
  )
);

-- Indexes
CREATE INDEX idx_wm_workspace_id   ON public.workspace_members (workspace_id);
CREATE INDEX idx_wm_user_id        ON public.workspace_members (user_id);
CREATE INDEX idx_wm_role           ON public.workspace_members (workspace_id, role);
CREATE INDEX idx_wm_invited_email  ON public.workspace_members (invited_email) WHERE invited_email IS NOT NULL;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- SELECT: any member of the same workspace can see the member list
CREATE POLICY "wm_select" ON public.workspace_members
  FOR SELECT
  USING (public.is_workspace_member(workspace_id));

-- INSERT: agency_admin of that workspace OR agency owner
CREATE POLICY "wm_insert" ON public.workspace_members
  FOR INSERT
  WITH CHECK (
    public.is_workspace_admin(workspace_id)
    OR workspace_id IN (
      SELECT w.id
      FROM   public.workspaces w
      JOIN   public.agencies   a ON a.id = w.agency_id
      WHERE  a.owner_id = auth.uid()
    )
  );

-- UPDATE: agency_admin of that workspace OR agency owner
CREATE POLICY "wm_update" ON public.workspace_members
  FOR UPDATE
  USING (
    public.is_workspace_admin(workspace_id)
    OR workspace_id IN (
      SELECT w.id
      FROM   public.workspaces w
      JOIN   public.agencies   a ON a.id = w.agency_id
      WHERE  a.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_workspace_admin(workspace_id)
    OR workspace_id IN (
      SELECT w.id
      FROM   public.workspaces w
      JOIN   public.agencies   a ON a.id = w.agency_id
      WHERE  a.owner_id = auth.uid()
    )
  );

-- DELETE: agency_admin of that workspace OR agency owner
--         (a member cannot delete themselves to avoid orphan workspaces)
CREATE POLICY "wm_delete" ON public.workspace_members
  FOR DELETE
  USING (
    public.is_workspace_admin(workspace_id)
    OR workspace_id IN (
      SELECT w.id
      FROM   public.workspaces w
      JOIN   public.agencies   a ON a.id = w.agency_id
      WHERE  a.owner_id = auth.uid()
    )
  );

-- ============================================================
-- Trigger: set joined_at when user_id is populated (invite accepted)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_member_joined()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.user_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.joined_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_wm_joined_at
  BEFORE UPDATE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_member_joined();
