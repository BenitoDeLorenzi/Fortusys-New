create extension if not exists "pgcrypto";

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null unique,
  role_id uuid references public.roles(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document text not null unique,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_charges (
  id uuid primary key default gen_random_uuid(),
  payer_id uuid references public.customers(id) on delete set null,
  description text not null,
  amount_cents integer not null check (amount_cents > 0),
  due_date date not null,
  status text not null default 'draft' check (
    status in ('draft', 'pending', 'paid', 'overdue', 'canceled')
  ),
  provider text check (provider in ('tecnospeed')),
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.real_estate_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'other' check (
    type in ('residential', 'commercial', 'seasonal', 'other')
  ),
  status text not null default 'active' check (status in ('active', 'inactive')),
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_users_role_id_idx on public.app_users(role_id);
create index if not exists billing_charges_payer_id_idx on public.billing_charges(payer_id);
create index if not exists billing_charges_status_idx on public.billing_charges(status);
create index if not exists billing_charges_due_date_idx on public.billing_charges(due_date);

alter table public.roles enable row level security;
alter table public.app_users enable row level security;
alter table public.customers enable row level security;
alter table public.billing_charges enable row level security;
alter table public.real_estate_assets enable row level security;

create policy "Authenticated users can read roles"
  on public.roles for select
  to authenticated
  using (true);

create policy "Authenticated users can read app users"
  on public.app_users for select
  to authenticated
  using (true);

create policy "Authenticated users can read customers"
  on public.customers for select
  to authenticated
  using (true);

create policy "Authenticated users can read charges"
  on public.billing_charges for select
  to authenticated
  using (true);

create policy "Authenticated users can read real estate assets"
  on public.real_estate_assets for select
  to authenticated
  using (true);

insert into public.roles (name, slug, permissions)
values
  ('Administrador', 'admin', '{"*": true}'::jsonb),
  ('Financeiro', 'financeiro', '{"billing": ["read", "write"]}'::jsonb),
  ('Imobiliaria', 'imobiliaria', '{"real_estate": ["read", "write"]}'::jsonb),
  ('Atendimento', 'atendimento', '{"billing": ["read"], "real_estate": ["read"]}'::jsonb)
on conflict (slug) do nothing;
