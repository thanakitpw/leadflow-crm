-- Add resend_domain_id to sending_domains for Resend API integration
ALTER TABLE public.sending_domains
  ADD COLUMN resend_domain_id text;

-- Index for quick lookup
CREATE INDEX idx_sending_domains_resend_id ON public.sending_domains (resend_domain_id) WHERE resend_domain_id IS NOT NULL;
