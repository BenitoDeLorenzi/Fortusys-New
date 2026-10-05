alter table public.payers
  add column if not exists roles text[] not null default array['payer']::text[];

alter table public.payers
  drop constraint if exists payers_roles_check;

alter table public.payers
  add constraint payers_roles_check check (
    cardinality(roles) > 0
    and roles <@ array['payer', 'tenant', 'buyer', 'guarantor']::text[]
  );

create index if not exists payers_roles_idx
  on public.payers using gin(roles);

notify pgrst, 'reload schema';
