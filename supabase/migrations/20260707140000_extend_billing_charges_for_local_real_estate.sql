alter table public.billing_charges
  drop constraint if exists billing_charges_status_check;

alter table public.billing_charges
  add constraint billing_charges_status_check check (
    status in (
      'draft',
      'pending',
      'pending_emission',
      'emitted',
      'emission_failed',
      'paid',
      'overdue',
      'canceled'
    )
  );

alter table public.billing_charges
  add column if not exists payer_profile_id uuid references public.payers(id) on delete set null,
  add column if not exists real_estate_lease_id uuid references public.real_estate_leases(id) on delete cascade,
  add column if not exists real_estate_asset_id uuid references public.real_estate_assets(id) on delete set null,
  add column if not exists assignor_id text,
  add column if not exists assignor_document text,
  add column if not exists assignor_name text,
  add column if not exists charge_type text not null default 'manual',
  add column if not exists installment_number integer,
  add column if not exists installment_total integer,
  add column if not exists issue_date date,
  add column if not exists emitted_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists provider_status text,
  add column if not exists provider_error text,
  add column if not exists provider_payload jsonb not null default '{}'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists billing_charges_payer_profile_id_idx
  on public.billing_charges(payer_profile_id);

create index if not exists billing_charges_real_estate_lease_id_idx
  on public.billing_charges(real_estate_lease_id);

create index if not exists billing_charges_real_estate_asset_id_idx
  on public.billing_charges(real_estate_asset_id);

create index if not exists billing_charges_assignor_document_idx
  on public.billing_charges(assignor_document);

create unique index if not exists billing_charges_real_estate_rent_installment_unique_idx
  on public.billing_charges(real_estate_lease_id, installment_number)
  where charge_type = 'real_estate_rent'
    and real_estate_lease_id is not null
    and installment_number is not null;

notify pgrst, 'reload schema';
