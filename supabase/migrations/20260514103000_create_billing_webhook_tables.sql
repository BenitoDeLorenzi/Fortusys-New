create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'tecnospeed',
  event_type text,
  assignor_document text,
  integration_id text,
  status text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

create table if not exists public.billing_ticket_status_cache (
  integration_id text primary key,
  provider text not null default 'tecnospeed',
  assignor_document text,
  status text,
  event_type text,
  last_payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists billing_webhook_events_integration_id_idx
  on public.billing_webhook_events(integration_id);

create index if not exists billing_webhook_events_assignor_document_idx
  on public.billing_webhook_events(assignor_document);

create index if not exists billing_ticket_status_cache_assignor_document_idx
  on public.billing_ticket_status_cache(assignor_document);

alter table public.billing_webhook_events enable row level security;
alter table public.billing_ticket_status_cache enable row level security;

create policy "Authenticated users can read billing webhook events"
  on public.billing_webhook_events for select
  to authenticated
  using (true);

create policy "Authenticated users can read billing ticket status cache"
  on public.billing_ticket_status_cache for select
  to authenticated
  using (true);

alter publication supabase_realtime add table public.billing_ticket_status_cache;

