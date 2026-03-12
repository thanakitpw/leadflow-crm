-- Migration: Create audit_logs table
-- Phase 1: Auth & Multi-tenant

-- ============================================================
-- Table: audit_logs
-- ============================================================
CREATE TABLE public.audit_logs (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  workspace_id   uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  action         text        NOT NULL,
  resource_type  text,
  resource_id    uuid,
  metadata       jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT audit_logs_pkey         PRIMARY KEY (id),
  CONSTRAINT audit_logs_action_check CHECK (action <> '')
);

-- Indexes: common query patterns — filter by workspace, user, action, resource, time
CREATE INDEX idx_audit_workspace_id    ON public.audit_logs (workspace_id);
CREATE INDEX idx_audit_user_id         ON public.audit_logs (user_id);
CREATE INDEX idx_audit_action          ON public.audit_logs (action);
CREATE INDEX idx_audit_resource        ON public.audit_logs (resource_type, resource_id) WHERE resource_type IS NOT NULL;
CREATE INDEX idx_audit_created_at      ON public.audit_logs (workspace_id, created_at DESC);

-- ============================================================
-- RLS
-- audit_logs are append-only; only agency_admin can read;
-- no direct UPDATE or DELETE is allowed (immutable audit trail)
-- ============================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: agency_admin of the workspace only
CREATE POLICY "audit_select" ON public.audit_logs
  FOR SELECT
  USING (public.is_workspace_admin(workspace_id));

-- INSERT: any member of the workspace can write an audit entry
--         (application-level inserts; use SECURITY DEFINER helper for server-side)
CREATE POLICY "audit_insert" ON public.audit_logs
  FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id));

-- UPDATE: nobody (audit logs must be immutable)
CREATE POLICY "audit_no_update" ON public.audit_logs
  FOR UPDATE
  USING (false);

-- DELETE: nobody (audit logs must be immutable)
CREATE POLICY "audit_no_delete" ON public.audit_logs
  FOR DELETE
  USING (false);

-- ============================================================
-- Helper: server-side audit log writer (SECURITY DEFINER so
-- application code can insert without exposing direct table access)
-- ============================================================
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_workspace_id  uuid,
  p_action        text,
  p_resource_type text DEFAULT NULL,
  p_resource_id   uuid DEFAULT NULL,
  p_metadata      jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    workspace_id,
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    p_workspace_id,
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    p_metadata
  );
END;
$$;
