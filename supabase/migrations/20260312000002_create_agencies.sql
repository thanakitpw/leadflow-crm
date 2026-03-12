-- Migration: Create agencies table
-- Phase 1: Auth & Multi-tenant

-- ============================================================
-- Table: agencies
-- ============================================================
CREATE TABLE public.agencies (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  slug       text        NOT NULL,
  owner_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT agencies_pkey       PRIMARY KEY (id),
  CONSTRAINT agencies_slug_key   UNIQUE (slug),
  CONSTRAINT agencies_name_check CHECK (name  <> ''),
  CONSTRAINT agencies_slug_check CHECK (slug  ~ '^[a-z0-9\-]+$')
);

-- Trigger: keep updated_at current
CREATE TRIGGER trg_agencies_updated_at
  BEFORE UPDATE ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX idx_agencies_owner_id ON public.agencies (owner_id);
CREATE INDEX idx_agencies_slug     ON public.agencies (slug);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

-- SELECT: owner OR any member of a workspace that belongs to this agency
CREATE POLICY "agencies_select" ON public.agencies
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT w.agency_id
      FROM   public.workspaces w
      JOIN   public.workspace_members wm ON wm.workspace_id = w.id
      WHERE  wm.user_id = auth.uid()
    )
  );

-- INSERT: any authenticated user can create an agency (they become owner)
CREATE POLICY "agencies_insert" ON public.agencies
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- UPDATE: owner only
CREATE POLICY "agencies_update" ON public.agencies
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- DELETE: owner only
CREATE POLICY "agencies_delete" ON public.agencies
  FOR DELETE
  USING (owner_id = auth.uid());
