-- Migration: Phase 3 — Email Outreach
-- Tables: sending_domains, email_templates, campaigns, campaign_contacts,
--         sequences, sequence_steps, sequence_enrollments, email_events, unsubscribes
-- Depends on Phase 1: workspaces, workspace_members
-- Depends on Phase 2: leads
-- Helper functions available: is_workspace_member(), is_workspace_admin(), workspace_role(), set_updated_at()

-- ============================================================
-- Table: sending_domains
-- ============================================================
CREATE TABLE public.sending_domains (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid(),
  workspace_id          uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Domain identity
  domain                text        NOT NULL,

  -- DNS verification status
  dkim_status           text        NOT NULL DEFAULT 'pending',
  spf_status            text        NOT NULL DEFAULT 'pending',
  dmarc_status          text        NOT NULL DEFAULT 'pending',

  -- DNS record values (populated after domain is added to Resend/SES)
  dkim_record           text,
  spf_record            text,
  dmarc_record          text,

  verified_at           timestamptz,

  -- Send rate control
  daily_send_limit      integer     NOT NULL DEFAULT 50,
  warmup_enabled        boolean     NOT NULL DEFAULT true,
  warmup_current_limit  integer     NOT NULL DEFAULT 10,
  warmup_started_at     timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sending_domains_pkey              PRIMARY KEY (id),
  CONSTRAINT sending_domains_domain_check      CHECK (domain <> ''),
  CONSTRAINT sending_domains_workspace_domain  UNIQUE (workspace_id, domain),
  CONSTRAINT sending_domains_dkim_status_check CHECK (dkim_status  IN ('pending', 'verified', 'failed')),
  CONSTRAINT sending_domains_spf_status_check  CHECK (spf_status   IN ('pending', 'verified', 'failed')),
  CONSTRAINT sending_domains_dmarc_status_check CHECK (dmarc_status IN ('pending', 'verified', 'failed')),
  CONSTRAINT sending_domains_daily_limit_check CHECK (daily_send_limit > 0),
  CONSTRAINT sending_domains_warmup_limit_check CHECK (warmup_current_limit > 0)
);

-- ============================================================
-- Table: email_templates
-- ============================================================
CREATE TABLE public.email_templates (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  workspace_id     uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  name             text        NOT NULL,
  subject          text        NOT NULL,
  body_html        text        NOT NULL,
  body_text        text,

  -- List of variable names used in the template e.g. ["lead_name","company"]
  variables        jsonb       NOT NULL DEFAULT '[]',

  category         text,
  is_ai_generated  boolean     NOT NULL DEFAULT false,
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT email_templates_pkey          PRIMARY KEY (id),
  CONSTRAINT email_templates_name_check    CHECK (name    <> ''),
  CONSTRAINT email_templates_subject_check CHECK (subject <> ''),
  CONSTRAINT email_templates_category_check CHECK (
    category IS NULL OR category IN ('fnb', 'sme', 'realestate', 'b2b', 'followup', 'custom')
  )
);

-- ============================================================
-- Table: campaigns
-- ============================================================
CREATE TABLE public.campaigns (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  workspace_id      uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  name              text        NOT NULL,
  template_id       uuid        NOT NULL REFERENCES public.email_templates(id) ON DELETE RESTRICT,
  sending_domain_id uuid        REFERENCES public.sending_domains(id) ON DELETE SET NULL,

  status            text        NOT NULL DEFAULT 'draft',

  -- Filter criteria stored as JSON: { tags: [...], score_min: 0, score_max: 100, status: [...] }
  audience_filter   jsonb,

  -- Scheduling
  scheduled_at      timestamptz,
  started_at        timestamptz,
  completed_at      timestamptz,

  -- Counters (denormalised for quick dashboard display; updated by triggers/jobs)
  total_recipients  integer     NOT NULL DEFAULT 0,

  created_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT campaigns_pkey              PRIMARY KEY (id),
  CONSTRAINT campaigns_name_check        CHECK (name <> ''),
  CONSTRAINT campaigns_status_check      CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled')),
  CONSTRAINT campaigns_recipients_check  CHECK (total_recipients >= 0)
);

-- ============================================================
-- Table: campaign_contacts
-- Junction between campaign and individual leads.
-- INSERT is done by the background sending job (service_role).
-- ============================================================
CREATE TABLE public.campaign_contacts (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  campaign_id  uuid        NOT NULL REFERENCES public.campaigns(id)  ON DELETE CASCADE,
  lead_id      uuid        NOT NULL REFERENCES public.leads(id)       ON DELETE CASCADE,

  status       text        NOT NULL DEFAULT 'pending',
  sent_at      timestamptz,
  message_id   text,          -- Resend message ID for tracking
  error_message text,

  CONSTRAINT campaign_contacts_pkey         PRIMARY KEY (id),
  CONSTRAINT campaign_contacts_unique       UNIQUE (campaign_id, lead_id),
  CONSTRAINT campaign_contacts_status_check CHECK (status IN ('pending', 'sent', 'failed', 'bounced'))
);

-- ============================================================
-- Table: sequences
-- ============================================================
CREATE TABLE public.sequences (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  workspace_id      uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  name              text        NOT NULL,
  description       text,
  status            text        NOT NULL DEFAULT 'draft',
  sending_domain_id uuid        REFERENCES public.sending_domains(id) ON DELETE SET NULL,

  created_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sequences_pkey         PRIMARY KEY (id),
  CONSTRAINT sequences_name_check   CHECK (name <> ''),
  CONSTRAINT sequences_status_check CHECK (status IN ('draft', 'active', 'paused', 'archived'))
);

-- ============================================================
-- Table: sequence_steps
-- ============================================================
CREATE TABLE public.sequence_steps (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  sequence_id  uuid        NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
  step_number  integer     NOT NULL,
  template_id  uuid        NOT NULL REFERENCES public.email_templates(id) ON DELETE RESTRICT,
  delay_days   integer     NOT NULL DEFAULT 1,
  condition    text        NOT NULL DEFAULT 'always',

  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sequence_steps_pkey            PRIMARY KEY (id),
  CONSTRAINT sequence_steps_unique          UNIQUE (sequence_id, step_number),
  CONSTRAINT sequence_steps_delay_check     CHECK (delay_days >= 0),
  CONSTRAINT sequence_steps_step_num_check  CHECK (step_number >= 1),
  CONSTRAINT sequence_steps_condition_check CHECK (
    condition IN ('always', 'if_opened', 'if_not_opened', 'if_clicked', 'if_not_clicked')
  )
);

-- ============================================================
-- Table: sequence_enrollments
-- ============================================================
CREATE TABLE public.sequence_enrollments (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  sequence_id  uuid        NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
  lead_id      uuid        NOT NULL REFERENCES public.leads(id)      ON DELETE CASCADE,

  current_step integer     NOT NULL DEFAULT 0,
  status       text        NOT NULL DEFAULT 'active',

  enrolled_at  timestamptz NOT NULL DEFAULT now(),
  last_step_at timestamptz,
  completed_at timestamptz,

  CONSTRAINT sequence_enrollments_pkey         PRIMARY KEY (id),
  CONSTRAINT sequence_enrollments_unique       UNIQUE (sequence_id, lead_id),
  CONSTRAINT sequence_enrollments_step_check   CHECK (current_step >= 0),
  CONSTRAINT sequence_enrollments_status_check CHECK (
    status IN ('active', 'paused', 'completed', 'unsubscribed', 'bounced')
  )
);

-- ============================================================
-- Table: email_events
-- Append-only event log. No UPDATE or DELETE allowed.
-- ============================================================
CREATE TABLE public.email_events (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  lead_id      uuid        REFERENCES public.leads(id)      ON DELETE SET NULL,
  campaign_id  uuid        REFERENCES public.campaigns(id)  ON DELETE SET NULL,
  sequence_id  uuid        REFERENCES public.sequences(id)  ON DELETE SET NULL,

  event_type   text        NOT NULL,
  message_id   text,

  -- Flexible metadata: click URL, bounce reason, user-agent, etc.
  metadata     jsonb,

  occurred_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT email_events_pkey             PRIMARY KEY (id),
  CONSTRAINT email_events_event_type_check CHECK (
    event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed')
  )
);

-- ============================================================
-- Table: unsubscribes
-- Global per-workspace opt-out list.
-- ============================================================
CREATE TABLE public.unsubscribes (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  workspace_id     uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  email            text        NOT NULL,
  reason           text,
  unsubscribed_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unsubscribes_pkey          PRIMARY KEY (id),
  CONSTRAINT unsubscribes_email_check   CHECK (email <> ''),
  CONSTRAINT unsubscribes_unique        UNIQUE (workspace_id, email)
);

-- ============================================================
-- Indexes
-- ============================================================

-- sending_domains
CREATE INDEX idx_sending_domains_workspace_id ON public.sending_domains (workspace_id);

-- email_templates
CREATE INDEX idx_email_templates_workspace_id ON public.email_templates (workspace_id);
CREATE INDEX idx_email_templates_category     ON public.email_templates (workspace_id, category) WHERE category IS NOT NULL;
CREATE INDEX idx_email_templates_created_by   ON public.email_templates (created_by) WHERE created_by IS NOT NULL;

-- campaigns
CREATE INDEX idx_campaigns_workspace_id       ON public.campaigns (workspace_id);
CREATE INDEX idx_campaigns_status             ON public.campaigns (workspace_id, status);
CREATE INDEX idx_campaigns_template_id        ON public.campaigns (template_id);
CREATE INDEX idx_campaigns_sending_domain_id  ON public.campaigns (sending_domain_id) WHERE sending_domain_id IS NOT NULL;
CREATE INDEX idx_campaigns_scheduled_at       ON public.campaigns (scheduled_at) WHERE scheduled_at IS NOT NULL;

-- campaign_contacts
CREATE INDEX idx_campaign_contacts_campaign_id        ON public.campaign_contacts (campaign_id);
CREATE INDEX idx_campaign_contacts_campaign_status    ON public.campaign_contacts (campaign_id, status);
CREATE INDEX idx_campaign_contacts_lead_id            ON public.campaign_contacts (lead_id);

-- sequences
CREATE INDEX idx_sequences_workspace_id      ON public.sequences (workspace_id);
CREATE INDEX idx_sequences_status            ON public.sequences (workspace_id, status);

-- sequence_steps
CREATE INDEX idx_sequence_steps_sequence_id  ON public.sequence_steps (sequence_id);
CREATE INDEX idx_sequence_steps_template_id  ON public.sequence_steps (template_id);

-- sequence_enrollments
CREATE INDEX idx_seq_enrollments_sequence_id    ON public.sequence_enrollments (sequence_id);
CREATE INDEX idx_seq_enrollments_sequence_status ON public.sequence_enrollments (sequence_id, status);
CREATE INDEX idx_seq_enrollments_lead_id         ON public.sequence_enrollments (lead_id);

-- email_events
CREATE INDEX idx_email_events_workspace_id        ON public.email_events (workspace_id);
CREATE INDEX idx_email_events_workspace_event_type ON public.email_events (workspace_id, event_type);
CREATE INDEX idx_email_events_message_id           ON public.email_events (message_id) WHERE message_id IS NOT NULL;
CREATE INDEX idx_email_events_lead_id              ON public.email_events (lead_id)    WHERE lead_id    IS NOT NULL;
CREATE INDEX idx_email_events_campaign_id          ON public.email_events (campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_email_events_sequence_id          ON public.email_events (sequence_id) WHERE sequence_id IS NOT NULL;
CREATE INDEX idx_email_events_occurred_at          ON public.email_events (workspace_id, occurred_at DESC);

-- unsubscribes
CREATE INDEX idx_unsubscribes_workspace_id    ON public.unsubscribes (workspace_id);
CREATE INDEX idx_unsubscribes_workspace_email ON public.unsubscribes (workspace_id, email);

-- ============================================================
-- RLS: Enable on all tables
-- ============================================================
ALTER TABLE public.sending_domains      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_contacts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequences            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_steps       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unsubscribes         ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies: sending_domains
-- SELECT: workspace members (all roles)
-- INSERT / UPDATE: agency_admin + agency_member
-- DELETE: agency_admin only
-- ============================================================
CREATE POLICY "sending_domains_select" ON public.sending_domains
  FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "sending_domains_insert" ON public.sending_domains
  FOR INSERT
  WITH CHECK (
    public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member')
  );

CREATE POLICY "sending_domains_update" ON public.sending_domains
  FOR UPDATE
  USING  (public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member'))
  WITH CHECK (public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member'));

CREATE POLICY "sending_domains_delete" ON public.sending_domains
  FOR DELETE
  USING (public.workspace_role(workspace_id) = 'agency_admin');

-- ============================================================
-- RLS Policies: email_templates
-- ============================================================
CREATE POLICY "email_templates_select" ON public.email_templates
  FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "email_templates_insert" ON public.email_templates
  FOR INSERT
  WITH CHECK (
    public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member')
  );

CREATE POLICY "email_templates_update" ON public.email_templates
  FOR UPDATE
  USING  (public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member'))
  WITH CHECK (public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member'));

CREATE POLICY "email_templates_delete" ON public.email_templates
  FOR DELETE
  USING (public.workspace_role(workspace_id) = 'agency_admin');

-- ============================================================
-- RLS Policies: campaigns
-- ============================================================
CREATE POLICY "campaigns_select" ON public.campaigns
  FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "campaigns_insert" ON public.campaigns
  FOR INSERT
  WITH CHECK (
    public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member')
  );

CREATE POLICY "campaigns_update" ON public.campaigns
  FOR UPDATE
  USING  (public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member'))
  WITH CHECK (public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member'));

CREATE POLICY "campaigns_delete" ON public.campaigns
  FOR DELETE
  USING (public.workspace_role(workspace_id) = 'agency_admin');

-- ============================================================
-- RLS Policies: campaign_contacts
-- SELECT: workspace members via parent campaign
-- INSERT: service_role only (background sending job)
-- UPDATE: service_role only (status updates from webhook)
-- DELETE: agency_admin only
-- ============================================================
CREATE POLICY "campaign_contacts_select" ON public.campaign_contacts
  FOR SELECT
  USING (
    campaign_id IN (
      SELECT id FROM public.campaigns
      WHERE  public.is_workspace_member(workspace_id)
    )
  );

-- Authenticated sessions are blocked; background jobs use service_role which bypasses RLS.
CREATE POLICY "campaign_contacts_insert" ON public.campaign_contacts
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "campaign_contacts_update" ON public.campaign_contacts
  FOR UPDATE
  USING (false);

CREATE POLICY "campaign_contacts_delete" ON public.campaign_contacts
  FOR DELETE
  USING (
    campaign_id IN (
      SELECT id FROM public.campaigns
      WHERE  public.workspace_role(workspace_id) = 'agency_admin'
    )
  );

-- ============================================================
-- RLS Policies: sequences
-- ============================================================
CREATE POLICY "sequences_select" ON public.sequences
  FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "sequences_insert" ON public.sequences
  FOR INSERT
  WITH CHECK (
    public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member')
  );

CREATE POLICY "sequences_update" ON public.sequences
  FOR UPDATE
  USING  (public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member'))
  WITH CHECK (public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member'));

CREATE POLICY "sequences_delete" ON public.sequences
  FOR DELETE
  USING (public.workspace_role(workspace_id) = 'agency_admin');

-- ============================================================
-- RLS Policies: sequence_steps
-- Access is gated through the parent sequence's workspace_id.
-- ============================================================
CREATE POLICY "sequence_steps_select" ON public.sequence_steps
  FOR SELECT
  USING (
    sequence_id IN (
      SELECT id FROM public.sequences
      WHERE  public.is_workspace_member(workspace_id)
    )
  );

CREATE POLICY "sequence_steps_insert" ON public.sequence_steps
  FOR INSERT
  WITH CHECK (
    sequence_id IN (
      SELECT id FROM public.sequences
      WHERE  public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member')
    )
  );

CREATE POLICY "sequence_steps_update" ON public.sequence_steps
  FOR UPDATE
  USING (
    sequence_id IN (
      SELECT id FROM public.sequences
      WHERE  public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member')
    )
  )
  WITH CHECK (
    sequence_id IN (
      SELECT id FROM public.sequences
      WHERE  public.workspace_role(workspace_id) IN ('agency_admin', 'agency_member')
    )
  );

CREATE POLICY "sequence_steps_delete" ON public.sequence_steps
  FOR DELETE
  USING (
    sequence_id IN (
      SELECT id FROM public.sequences
      WHERE  public.workspace_role(workspace_id) = 'agency_admin'
    )
  );

-- ============================================================
-- RLS Policies: sequence_enrollments
-- INSERT / UPDATE: service_role (enrollment job) bypasses RLS.
-- Authenticated users see enrollments for sequences in their workspace.
-- ============================================================
CREATE POLICY "sequence_enrollments_select" ON public.sequence_enrollments
  FOR SELECT
  USING (
    sequence_id IN (
      SELECT id FROM public.sequences
      WHERE  public.is_workspace_member(workspace_id)
    )
  );

-- Background jobs handle INSERT/UPDATE via service_role (bypasses RLS).
CREATE POLICY "sequence_enrollments_insert" ON public.sequence_enrollments
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "sequence_enrollments_update" ON public.sequence_enrollments
  FOR UPDATE
  USING (false);

CREATE POLICY "sequence_enrollments_delete" ON public.sequence_enrollments
  FOR DELETE
  USING (
    sequence_id IN (
      SELECT id FROM public.sequences
      WHERE  public.workspace_role(workspace_id) = 'agency_admin'
    )
  );

-- ============================================================
-- RLS Policies: email_events
-- Append-only — no UPDATE or DELETE for any authenticated user.
-- INSERT is handled by service_role (webhook receiver).
-- ============================================================
CREATE POLICY "email_events_select" ON public.email_events
  FOR SELECT
  USING (public.is_workspace_member(workspace_id));

-- Webhook handlers use service_role which bypasses RLS.
CREATE POLICY "email_events_insert" ON public.email_events
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "email_events_no_update" ON public.email_events
  FOR UPDATE
  USING (false);

CREATE POLICY "email_events_no_delete" ON public.email_events
  FOR DELETE
  USING (false);

-- ============================================================
-- RLS Policies: unsubscribes
-- SELECT: workspace members (all roles)
-- INSERT: service_role (unsubscribe webhook) + agency_admin (manual add)
-- UPDATE: agency_admin only
-- DELETE: agency_admin only
-- ============================================================
CREATE POLICY "unsubscribes_select" ON public.unsubscribes
  FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "unsubscribes_insert" ON public.unsubscribes
  FOR INSERT
  WITH CHECK (
    public.workspace_role(workspace_id) = 'agency_admin'
  );

CREATE POLICY "unsubscribes_update" ON public.unsubscribes
  FOR UPDATE
  USING  (public.workspace_role(workspace_id) = 'agency_admin')
  WITH CHECK (public.workspace_role(workspace_id) = 'agency_admin');

CREATE POLICY "unsubscribes_delete" ON public.unsubscribes
  FOR DELETE
  USING (public.workspace_role(workspace_id) = 'agency_admin');

-- ============================================================
-- Triggers: keep updated_at current
-- ============================================================
CREATE TRIGGER trg_sending_domains_updated_at
  BEFORE UPDATE ON public.sending_domains
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_sequences_updated_at
  BEFORE UPDATE ON public.sequences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
