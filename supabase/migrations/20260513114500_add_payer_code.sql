alter table public.payers
  add column if not exists code integer;

update public.payers
set code = nullif(regexp_replace(metadata->>'codigo', '\D', '', 'g'), '')::integer
where code is null
  and metadata ? 'codigo'
  and nullif(regexp_replace(metadata->>'codigo', '\D', '', 'g'), '') is not null;

create unique index if not exists payers_code_unique_idx
  on public.payers(code)
  where code is not null;

create index if not exists payers_code_idx on public.payers(code desc);

