alter table public.real_estate_assets
  add column if not exists firestore_id text,
  add column if not exists code integer,
  add column if not exists property_name text,
  add column if not exists zip_code text,
  add column if not exists street text,
  add column if not exists number text,
  add column if not exists district text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists bedrooms text,
  add column if not exists bathrooms text,
  add column if not exists garage text,
  add column if not exists area text,
  add column if not exists registration_number text,
  add column if not exists municipal_registration text,
  add column if not exists rent_amount text,
  add column if not exists condominium_amount text,
  add column if not exists iptu_amount text,
  add column if not exists water_amount text,
  add column if not exists energy_amount text,
  add column if not exists gas_amount text,
  add column if not exists trash_amount text,
  add column if not exists reserve_fund_amount text,
  add column if not exists other_amount text,
  add column if not exists commission_type text,
  add column if not exists commission_percentage text,
  add column if not exists commission_amount text,
  add column if not exists landlord_firestore_id text,
  add column if not exists landlord_code integer,
  add column if not exists landlord_name text,
  add column if not exists landlord_document text,
  add column if not exists landlord_email text,
  add column if not exists landlord_phone text,
  add column if not exists contract_firestore_id text,
  add column if not exists highlight boolean not null default false,
  add column if not exists photos jsonb not null default '[]'::jsonb,
  add column if not exists documents jsonb not null default '[]'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.real_estate_assets
  drop constraint if exists real_estate_assets_status_check;

alter table public.real_estate_assets
  alter column status set default 'available';

create unique index if not exists real_estate_assets_firestore_id_unique_idx
  on public.real_estate_assets(firestore_id)
  where firestore_id is not null;

create unique index if not exists real_estate_assets_code_unique_idx
  on public.real_estate_assets(code)
  where code is not null;

create index if not exists real_estate_assets_landlord_firestore_id_idx
  on public.real_estate_assets(landlord_firestore_id);

create index if not exists real_estate_assets_status_idx
  on public.real_estate_assets(status);

create index if not exists real_estate_assets_code_idx
  on public.real_estate_assets(code desc);
