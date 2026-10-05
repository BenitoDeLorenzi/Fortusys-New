create table if not exists public.real_estate_legacy_billings (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.real_estate_assets(id) on delete set null,
  firestore_asset_id text not null,
  property_code integer,
  property_title text,
  provider text not null default 'tecnospeed',
  provider_status text,
  integration_id text not null,
  print_id text,
  document_number text,
  our_number text,
  bank_code text,
  account_number text,
  agreement_number text,
  reference_code text,
  assignor_document text,
  created_at_provider timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  unique (provider, integration_id)
);

create index if not exists real_estate_legacy_billings_asset_id_idx
  on public.real_estate_legacy_billings(asset_id);

create index if not exists real_estate_legacy_billings_firestore_asset_id_idx
  on public.real_estate_legacy_billings(firestore_asset_id);

create index if not exists real_estate_legacy_billings_created_at_provider_idx
  on public.real_estate_legacy_billings(created_at_provider desc);
