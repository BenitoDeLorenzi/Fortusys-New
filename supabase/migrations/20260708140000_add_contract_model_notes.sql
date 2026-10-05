alter table public.real_estate_contract_models
  add column if not exists notes text;

notify pgrst, 'reload schema';
