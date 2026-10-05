do $$
declare
  constraint_name text;
begin
  select conname
    into constraint_name
  from pg_constraint
  where conrelid = 'public.real_estate_charges'::regclass
    and contype = 'u'
    and conkey = array[
      (select attnum from pg_attribute where attrelid = 'public.real_estate_charges'::regclass and attname = 'lease_id'),
      (select attnum from pg_attribute where attrelid = 'public.real_estate_charges'::regclass and attname = 'competence_month'),
      (select attnum from pg_attribute where attrelid = 'public.real_estate_charges'::regclass and attname = 'competence_year')
    ];

  if constraint_name is not null then
    execute format(
      'alter table public.real_estate_charges drop constraint %I',
      constraint_name
    );
  end if;
end $$;

drop index if exists public.real_estate_charges_active_competence_unique_idx;

create unique index real_estate_charges_active_competence_unique_idx
  on public.real_estate_charges(lease_id, competence_month, competence_year)
  where status <> 'canceled';
