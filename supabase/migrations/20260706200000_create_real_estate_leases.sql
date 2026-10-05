create table if not exists public.real_estate_leases (
  id uuid primary key default gen_random_uuid(),
  firestore_id text unique,
  code integer,
  asset_id uuid not null unique references public.real_estate_assets(id) on delete cascade,
  tenant_id uuid not null references public.payers(id) on delete restrict,
  status text not null default 'draft' check (
    status in ('draft', 'active', 'ended', 'canceled')
  ),
  contract_number text,
  start_date date not null,
  end_date date not null,
  payment_due_day smallint check (
    payment_due_day is null or payment_due_day between 1 and 31
  ),
  rent_amount_cents integer not null check (rent_amount_cents > 0),
  guarantee_type text not null default 'none' check (
    guarantee_type in (
      'none',
      'deposit',
      'guarantor',
      'insurance',
      'capitalization'
    )
  ),
  guarantee_amount_cents integer check (
    guarantee_amount_cents is null or guarantee_amount_cents >= 0
  ),
  adjustment_index text not null default 'ipca' check (
    adjustment_index in ('none', 'ipca', 'igpm', 'other')
  ),
  next_adjustment_date date,
  guarantor_firestore_id text,
  guarantor_name text,
  guarantor_document text,
  notes text,
  legacy_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists real_estate_leases_tenant_id_idx
  on public.real_estate_leases(tenant_id);

create index if not exists real_estate_leases_firestore_id_idx
  on public.real_estate_leases(firestore_id);

create index if not exists real_estate_leases_status_idx
  on public.real_estate_leases(status);

alter table public.real_estate_leases enable row level security;

create policy "Authenticated users can read real estate leases"
  on public.real_estate_leases for select
  to authenticated
  using (true);
