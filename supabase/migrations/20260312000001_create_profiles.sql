-- Migration: Create profiles table
-- Phase 1: Auth & Multi-tenant
-- Links to Supabase Auth (auth.users)

-- ============================================================
-- Helper: updated_at auto-update function (shared across all tables)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- Table: profiles
-- ============================================================
CREATE TABLE public.profiles (
  id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_email_check CHECK (email <> '')
);

-- Trigger: keep updated_at current
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Index: lookup by email (invite flow)
CREATE UNIQUE INDEX idx_profiles_email ON public.profiles (email);

-- ============================================================
-- Trigger: auto-create profile when auth.users row is inserted
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: own profile OR co-member in any shared workspace
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR id IN (
      SELECT wm.user_id
      FROM   public.workspace_members wm
      WHERE  wm.workspace_id IN (
        SELECT workspace_id
        FROM   public.workspace_members
        WHERE  user_id = auth.uid()
      )
    )
  );

-- INSERT: only the authenticated user can create their own profile
-- (normally handled by the trigger above, but guard just in case)
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- UPDATE: own profile only
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- DELETE: own profile only (cascades from auth.users anyway)
CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE
  USING (id = auth.uid());
