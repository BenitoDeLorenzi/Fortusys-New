alter table public.real_estate_contract_models
  add column if not exists witness_1_name text,
  add column if not exists witness_1_document text,
  add column if not exists witness_2_name text,
  add column if not exists witness_2_document text,
  add column if not exists clauses jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
