alter table public.payers
  drop constraint if exists payers_roles_check;

alter table public.payers
  add constraint payers_roles_check check (
    cardinality(roles) > 0
    and roles <@ array['payer', 'tenant', 'buyer', 'guarantor']::text[]
  );

alter table public.real_estate_leases
  add column if not exists guarantor_id uuid references public.payers(id);

create index if not exists real_estate_leases_guarantor_id_idx
  on public.real_estate_leases(guarantor_id);

notify pgrst, 'reload schema';
