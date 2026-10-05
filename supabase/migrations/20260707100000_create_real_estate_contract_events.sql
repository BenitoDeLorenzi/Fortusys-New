create table if not exists public.real_estate_contract_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.real_estate_assets(id) on delete cascade,
  lease_id uuid references public.real_estate_leases(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'created',
      'updated',
      'activated',
      'ended',
      'canceled',
      'renewed'
    )
  ),
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists real_estate_contract_events_asset_idx
  on public.real_estate_contract_events(asset_id, created_at desc);

create index if not exists real_estate_contract_events_lease_idx
  on public.real_estate_contract_events(lease_id, created_at desc);

notify pgrst, 'reload schema';
