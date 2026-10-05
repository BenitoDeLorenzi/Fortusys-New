alter table public.real_estate_charges
  add column if not exists ticket_print_id text,
  add column if not exists ticket_document_number text,
  add column if not exists ticket_our_number text,
  add column if not exists ticket_bank_code text,
  add column if not exists ticket_account_number text,
  add column if not exists ticket_agreement_number text,
  add column if not exists ticket_reference_code text,
  add column if not exists ticket_assignor_document text,
  add column if not exists ticket_provider_status text,
  add column if not exists ticket_provider_payload jsonb not null default '{}'::jsonb;
