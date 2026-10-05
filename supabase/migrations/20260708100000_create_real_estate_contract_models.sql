create table if not exists public.real_estate_contract_models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contract_purpose text not null check (contract_purpose in ('rental', 'sale')),
  property_usage text not null check (property_usage in ('residential', 'commercial')),
  description text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists real_estate_contract_models_purpose_usage_idx
  on public.real_estate_contract_models(contract_purpose, property_usage);

create index if not exists real_estate_contract_models_status_idx
  on public.real_estate_contract_models(status);

insert into public.real_estate_contract_models (
  name,
  contract_purpose,
  property_usage,
  description,
  status,
  is_default
)
select *
from (
  values
    (
      'Contrato de locação residencial',
      'rental',
      'residential',
      'Modelo padrão para locação de imóveis residenciais.',
      'active',
      true
    ),
    (
      'Contrato de locação comercial',
      'rental',
      'commercial',
      'Modelo padrão para locação de imóveis comerciais.',
      'active',
      true
    ),
    (
      'Contrato de venda residencial',
      'sale',
      'residential',
      'Modelo padrão para venda de imóveis residenciais.',
      'active',
      true
    ),
    (
      'Contrato de venda comercial',
      'sale',
      'commercial',
      'Modelo padrão para venda de imóveis comerciais.',
      'active',
      true
    )
) as defaults(name, contract_purpose, property_usage, description, status, is_default)
where not exists (
  select 1
  from public.real_estate_contract_models existing
  where existing.contract_purpose = defaults.contract_purpose
    and existing.property_usage = defaults.property_usage
    and existing.is_default = true
);

notify pgrst, 'reload schema';
