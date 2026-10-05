alter table public.real_estate_assets
  drop constraint if exists real_estate_assets_type_check;

alter table public.real_estate_assets
  add constraint real_estate_assets_type_check
  check (
    type in (
      'residential',
      'commercial',
      'seasonal',
      'other',
      'house',
      'apartment',
      'office',
      'room',
      'condominium',
      'warehouse',
      'land'
    )
  );
