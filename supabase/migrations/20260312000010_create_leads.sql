-- Migration: Phase 2 — Lead Generation
-- Tables: leads, lead_scores, lead_tags, places_cache
-- Depends on Phase 1: workspaces, workspace_members
-- Helper functions available: is_workspace_member(), is_workspace_admin(), workspace_role(), set_updated_at()

-- ============================================================
-- Table: leads
-- ============================================================
CREATE TABLE public.leads (
  id            uuid            NOT NULL DEFAULT gen_random_uuid(),
  workspace_id  uuid            NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Core business info
  name          text            NOT NULL,
  address       text,
  phone         text,
  website       text,

  -- Email info
  email         text,

  -- Google Places identity
  place_id      text,

  -- Geo
  latitude      double precision,
  longitude     double precision,

  -- Google metrics
  rating        numeric(2,1),
  review_count  integer         NOT NULL DEFAULT 0,

  -- Classification
  category      text,

  -- Source & workflow state
  source_type   text            NOT NULL DEFAULT 'places_api',
  status        text            NOT NULL DEFAULT 'new',

  -- Extra notes
  notes         text,

  created_at    timestamptz     NOT NULL DEFAULT now(),
  updated_at    timestamptz     NOT NULL DEFAULT now(),

  CONSTRAINT leads_pkey                   PRIMARY KEY (id),
  CONSTRAINT leads_name_check             CHECK (name <> ''),
  CONSTRAINT leads_rating_check           CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  CONSTRAINT leads_review_count_check     CHECK (review_count >= 0),
  CONSTRAINT leads_source_type_check      CHECK (source_type IN ('places_api', 'manual', 'import')),
  CONSTRAINT leads_status_check           CHECK (status IN ('new', 'contacted', 'qualified', 'unqualified')),

  -- Deduplication: same Google place cannot appear twice in the same workspace
  CONSTRAINT leads_workspace_place_unique UNIQUE (workspace_id, place_id)
);

-- Indexes
CREATE INDEX idx_leads_workspace_id  ON public.leads (workspace_id);
CREATE INDEX idx_leads_place_id      ON public.leads (place_id)                    WHERE place_id IS NOT NULL;
CREATE INDEX idx_leads_status        ON public.leads (workspace_id, status);
CREATE INDEX idx_leads_category      ON public.leads (workspace_id, category)      WHERE category IS NOT NULL;
CREATE INDEX idx_leads_email         ON public.leads (workspace_id, email)         WHERE email    IS NOT NULL;

-- ============================================================
-- RLS: leads
-- SELECT / INSERT / UPDATE: workspace members (all roles)
-- DELETE: agency_admin and agency_member only
-- ============================================================
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_select" ON public.leads
  FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "leads_insert" ON public.leads
  FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "leads_update" ON public.leads
  FOR UPDATE
  USING  (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "leads_delete" ON public.leads
  FOR DELETE
  USING (
    public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member')
  );

-- Trigger: keep updated_at current
CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Table: lead_scores
-- Append-only AI scoring records
-- ============================================================
CREATE TABLE public.lead_scores (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  lead_id       uuid        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  score         integer     NOT NULL,
  reasoning     text,
  scored_at     timestamptz NOT NULL DEFAULT now(),
  model_version text        NOT NULL DEFAULT 'claude-sonnet-4-6',

  CONSTRAINT lead_scores_pkey        PRIMARY KEY (id),
  CONSTRAINT lead_scores_score_check CHECK (score >= 0 AND score <= 100)
);

-- Indexes
CREATE INDEX idx_lead_scores_lead_id   ON public.lead_scores (lead_id);
CREATE INDEX idx_lead_scores_score     ON public.lead_scores (lead_id, score DESC);

-- ============================================================
-- RLS: lead_scores
-- Access is gated through the parent lead's workspace_id.
-- SELECT: workspace members
-- INSERT: service role (AI scoring job) — authenticated users blocked
-- UPDATE / DELETE: nobody (immutable scoring history)
-- ============================================================
ALTER TABLE public.lead_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_scores_select" ON public.lead_scores
  FOR SELECT
  USING (
    lead_id IN (
      SELECT id FROM public.leads
      WHERE  public.is_workspace_member(workspace_id)
    )
  );

-- Service role bypasses RLS by default; this policy covers
-- authenticated sessions (e.g., admin triggering a manual score).
-- Background AI jobs should use service_role key instead.
CREATE POLICY "lead_scores_insert" ON public.lead_scores
  FOR INSERT
  WITH CHECK (false);  -- blocked for all authenticated users; service_role bypasses RLS

CREATE POLICY "lead_scores_no_update" ON public.lead_scores
  FOR UPDATE
  USING (false);

CREATE POLICY "lead_scores_no_delete" ON public.lead_scores
  FOR DELETE
  USING (false);

-- ============================================================
-- Table: lead_tags
-- ============================================================
CREATE TABLE public.lead_tags (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  lead_id    uuid        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tag        text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT lead_tags_pkey            PRIMARY KEY (id),
  CONSTRAINT lead_tags_tag_check       CHECK (tag <> ''),
  CONSTRAINT lead_tags_lead_tag_unique UNIQUE (lead_id, tag)
);

-- Indexes
CREATE INDEX idx_lead_tags_lead_id ON public.lead_tags (lead_id);

-- ============================================================
-- RLS: lead_tags
-- All operations: workspace members (all roles)
-- client_viewer gets SELECT only — no INSERT/DELETE
-- ============================================================
ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_tags_select" ON public.lead_tags
  FOR SELECT
  USING (
    lead_id IN (
      SELECT id FROM public.leads
      WHERE  public.is_workspace_member(workspace_id)
    )
  );

CREATE POLICY "lead_tags_insert" ON public.lead_tags
  FOR INSERT
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.leads
      WHERE  public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member')
    )
  );

CREATE POLICY "lead_tags_update" ON public.lead_tags
  FOR UPDATE
  USING (
    lead_id IN (
      SELECT id FROM public.leads
      WHERE  public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member')
    )
  )
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.leads
      WHERE  public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member')
    )
  );

CREATE POLICY "lead_tags_delete" ON public.lead_tags
  FOR DELETE
  USING (
    lead_id IN (
      SELECT id FROM public.leads
      WHERE  public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member')
    )
  );

-- ============================================================
-- Table: places_cache
-- Shared Google Places API response cache (service_role access only).
-- RLS enabled with explicit policies — authenticated users can read,
-- write is restricted to service_role which bypasses RLS.
-- TTL enforced via expires_at; application calls cleanup_expired_places_cache()
-- periodically or uses pg_cron.
-- ============================================================
CREATE TABLE public.places_cache (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  cache_key   text        NOT NULL,
  cache_type  text        NOT NULL DEFAULT 'search',
  results     jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  hit_count   integer     NOT NULL DEFAULT 0,

  CONSTRAINT places_cache_pkey            PRIMARY KEY (id),
  CONSTRAINT places_cache_key_unique      UNIQUE (cache_key),
  CONSTRAINT places_cache_type_check      CHECK (cache_type IN ('search', 'details')),
  CONSTRAINT places_cache_hit_count_check CHECK (hit_count >= 0)
);

-- Indexes
-- cache_key UNIQUE constraint already creates an implicit B-tree index.
CREATE INDEX idx_places_cache_expires_at ON public.places_cache (expires_at);

-- ============================================================
-- RLS: places_cache
-- Service role bypasses RLS entirely (used by backend jobs).
-- Authenticated users can SELECT (read cached data for display).
-- No authenticated INSERT/UPDATE/DELETE — backend handles writes.
-- ============================================================
ALTER TABLE public.places_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "places_cache_service_role_all" ON public.places_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "places_cache_authenticated_select" ON public.places_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- Helper: purge expired cache entries
-- Call from pg_cron, a scheduled Supabase Edge Function, or manually.
-- Returns the number of rows deleted.
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_places_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.places_cache
  WHERE  expires_at < now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ============================================================
-- Helper: atomic increment of hit_count for cache entries
-- Called by Python API on every cache hit.
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_cache_hit_count(p_cache_key text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.places_cache
  SET    hit_count = hit_count + 1
  WHERE  cache_key = p_cache_key;
$$;
