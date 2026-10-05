alter table public.real_estate_leases
  add column if not exists firestore_id text,
  add column if not exists code integer,
  add column if not exists guarantor_firestore_id text,
  add column if not exists guarantor_name text,
  add column if not exists guarantor_document text,
  add column if not exists legacy_metadata jsonb not null default '{}'::jsonb;

alter table public.real_estate_leases
  alter column payment_due_day drop not null;

create unique index if not exists real_estate_leases_firestore_id_unique_idx
  on public.real_estate_leases(firestore_id);

create index if not exists real_estate_leases_code_idx
  on public.real_estate_leases(code);

notify pgrst, 'reload schema';
