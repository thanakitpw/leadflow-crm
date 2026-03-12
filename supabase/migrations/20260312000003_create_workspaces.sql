-- Migration: Create workspaces table
-- Phase 1: Auth & Multi-tenant

-- ============================================================
-- Table: workspaces
-- ============================================================
CREATE TABLE public.workspaces (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  agency_id  uuid        NOT NULL REFERENCES public.agencies(id) ON DELETE RESTRICT,
  name       text        NOT NULL,
  type       text        NOT NULL DEFAULT 'client',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT workspaces_pkey       PRIMARY KEY (id),
  CONSTRAINT workspaces_name_check CHECK (name <> ''),
  CONSTRAINT workspaces_type_check CHECK (type IN ('agency', 'client'))
);

-- Trigger: keep updated_at current
CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX idx_workspaces_agency_id ON public.workspaces (agency_id);
CREATE INDEX idx_workspaces_type      ON public.workspaces (type);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- SELECT: workspace member only
CREATE POLICY "workspaces_select" ON public.workspaces
  FOR SELECT
  USING (
    id IN (
      SELECT workspace_id
      FROM   public.workspace_members
      WHERE  user_id = auth.uid()
    )
  );

-- INSERT: agency owner only (they must own the agency)
CREATE POLICY "workspaces_insert" ON public.workspaces
  FOR INSERT
  WITH CHECK (
    agency_id IN (
      SELECT id
      FROM   public.agencies
      WHERE  owner_id = auth.uid()
    )
  );

-- UPDATE: agency_admin of this workspace OR agency owner
CREATE POLICY "workspaces_update" ON public.workspaces
  FOR UPDATE
  USING (
    id IN (
      SELECT workspace_id
      FROM   public.workspace_members
      WHERE  user_id = auth.uid()
        AND  role    = 'agency_admin'
    )
    OR agency_id IN (
      SELECT id FROM public.agencies WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    id IN (
      SELECT workspace_id
      FROM   public.workspace_members
      WHERE  user_id = auth.uid()
        AND  role    = 'agency_admin'
    )
    OR agency_id IN (
      SELECT id FROM public.agencies WHERE owner_id = auth.uid()
    )
  );

-- DELETE: agency owner only
CREATE POLICY "workspaces_delete" ON public.workspaces
  FOR DELETE
  USING (
    agency_id IN (
      SELECT id FROM public.agencies WHERE owner_id = auth.uid()
    )
  );
