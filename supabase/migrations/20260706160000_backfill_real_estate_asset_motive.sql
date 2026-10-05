update public.real_estate_assets
set
  motive = nullif(trim(metadata->>'motivo'), ''),
  updated_at = now()
where
  motive is null
  and metadata ? 'motivo'
  and nullif(trim(metadata->>'motivo'), '') is not null;
