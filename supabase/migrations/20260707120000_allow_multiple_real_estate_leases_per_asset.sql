alter table public.real_estate_leases
  drop constraint if exists real_estate_leases_asset_id_key;

drop index if exists public.real_estate_leases_asset_id_key;

create index if not exists real_estate_leases_asset_id_idx
  on public.real_estate_leases(asset_id);

notify pgrst, 'reload schema';
