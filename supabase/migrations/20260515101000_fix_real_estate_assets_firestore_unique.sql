drop index if exists public.real_estate_assets_firestore_id_unique_idx;

create unique index if not exists real_estate_assets_firestore_id_unique_idx
  on public.real_estate_assets(firestore_id);
