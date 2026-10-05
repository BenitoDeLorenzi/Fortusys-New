alter table public.real_estate_assets
  add column if not exists motive text,
  add column if not exists notes text,
  add column if not exists payer_condominium text,
  add column if not exists payer_iptu text,
  add column if not exists energy_contract text,
  add column if not exists energy_meter text,
  add column if not exists water_contract text,
  add column if not exists water_meter text;
