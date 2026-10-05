create table if not exists public.payers (
  id uuid primary key default gen_random_uuid(),
  firestore_id text unique,
  name text not null,
  document text not null unique,
  email text,
  phone text,
  zip_code text,
  street text,
  number text,
  complement text,
  district text,
  city text,
  state text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payers_document_idx on public.payers(document);
create index if not exists payers_name_idx on public.payers using gin (to_tsvector('portuguese', name));
create index if not exists payers_status_idx on public.payers(status);

alter table public.payers enable row level security;

create policy "Authenticated users can read payers"
  on public.payers for select
  to authenticated
  using (true);

