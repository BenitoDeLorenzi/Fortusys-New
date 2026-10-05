create table if not exists public.real_estate_charge_tickets (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.real_estate_charges(id) on delete cascade,
  provider text not null default 'tecnospeed',
  integration_id text,
  print_id text,
  document_number text,
  our_number text,
  bank_code text,
  account_number text,
  agreement_number text,
  reference_code text,
  assignor_document text,
  provider_status text,
  ticket_status text not null default 'registering' check (
    ticket_status in ('not_generated', 'registering', 'registered', 'failed', 'canceled')
  ),
  url text,
  pix_url text,
  digitable_line text,
  error_message text,
  provider_payload jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists real_estate_charge_tickets_charge_id_idx
  on public.real_estate_charge_tickets(charge_id);

create index if not exists real_estate_charge_tickets_integration_id_idx
  on public.real_estate_charge_tickets(integration_id);

create unique index if not exists real_estate_charge_tickets_active_unique_idx
  on public.real_estate_charge_tickets(charge_id)
  where is_active;

insert into public.real_estate_charge_tickets (
  charge_id,
  provider,
  integration_id,
  print_id,
  document_number,
  our_number,
  bank_code,
  account_number,
  agreement_number,
  reference_code,
  assignor_document,
  provider_status,
  ticket_status,
  url,
  pix_url,
  digitable_line,
  error_message,
  provider_payload,
  is_active,
  created_at,
  updated_at
)
select
  id,
  coalesce(ticket_provider, 'tecnospeed'),
  ticket_integration_id,
  ticket_print_id,
  ticket_document_number,
  ticket_our_number,
  ticket_bank_code,
  ticket_account_number,
  ticket_agreement_number,
  ticket_reference_code,
  ticket_assignor_document,
  ticket_provider_status,
  ticket_status,
  ticket_url,
  ticket_pix_url,
  ticket_digitable_line,
  ticket_error_message,
  coalesce(ticket_provider_payload, '{}'::jsonb),
  ticket_status in ('registering', 'registered')
    and coalesce(ticket_provider_status, '') not in ('BAIXADO', 'CANCELADO', 'FALHA', 'REJEITADO'),
  coalesce(ticket_generated_at, created_at),
  updated_at
from public.real_estate_charges
where ticket_status <> 'not_generated'
  and not exists (
    select 1
    from public.real_estate_charge_tickets tickets
    where tickets.charge_id = real_estate_charges.id
  );

alter table public.real_estate_charge_tickets enable row level security;

drop policy if exists "Authenticated users can read real estate charge tickets" on public.real_estate_charge_tickets;
create policy "Authenticated users can read real estate charge tickets"
  on public.real_estate_charge_tickets for select
  to authenticated
  using (true);

do $$
begin
  alter publication supabase_realtime add table public.real_estate_charge_tickets;
exception
  when duplicate_object then null;
end $$;
