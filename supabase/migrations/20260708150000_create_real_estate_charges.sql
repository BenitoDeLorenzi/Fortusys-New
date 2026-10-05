create table if not exists public.real_estate_charges (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.real_estate_assets(id) on delete restrict,
  lease_id uuid not null references public.real_estate_leases(id) on delete restrict,
  tenant_id uuid not null references public.payers(id) on delete restrict,
  competence_month integer not null check (competence_month between 1 and 12),
  competence_year integer not null check (competence_year between 2000 and 2100),
  due_date date not null,
  rent_amount_cents integer not null default 0 check (rent_amount_cents >= 0),
  additional_amount_cents integer not null default 0 check (additional_amount_cents >= 0),
  discount_amount_cents integer not null default 0 check (discount_amount_cents >= 0),
  total_amount_cents integer not null default 0 check (total_amount_cents >= 0),
  status text not null default 'open' check (status in ('open', 'paid', 'overdue', 'canceled')),
  ticket_status text not null default 'not_generated' check (ticket_status in ('not_generated', 'registering', 'registered', 'failed', 'canceled')),
  ticket_provider text,
  ticket_integration_id text,
  ticket_url text,
  ticket_digitable_line text,
  ticket_pix_url text,
  ticket_error_message text,
  ticket_generated_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lease_id, competence_month, competence_year)
);

create table if not exists public.real_estate_charge_items (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.real_estate_charges(id) on delete cascade,
  type text not null check (
    type in (
      'rent',
      'iptu',
      'condominium',
      'reserve_fund',
      'water',
      'energy',
      'trash',
      'gas',
      'other',
      'discount'
    )
  ),
  description text,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists real_estate_charges_asset_id_idx
  on public.real_estate_charges(asset_id);

create index if not exists real_estate_charges_lease_id_idx
  on public.real_estate_charges(lease_id);

create index if not exists real_estate_charges_tenant_id_idx
  on public.real_estate_charges(tenant_id);

create index if not exists real_estate_charges_competence_idx
  on public.real_estate_charges(competence_year desc, competence_month desc);

create index if not exists real_estate_charge_items_charge_id_idx
  on public.real_estate_charge_items(charge_id);
