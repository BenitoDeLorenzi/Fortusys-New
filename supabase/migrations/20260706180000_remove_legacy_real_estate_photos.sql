update public.real_estate_assets
set
  photos = coalesce(
    (
      select jsonb_agg(photo order by position)
      from jsonb_array_elements(photos) with ordinality as items(photo, position)
      where
        jsonb_typeof(photo) = 'object'
        and nullif(photo ->> 'storagePath', '') is not null
    ),
    '[]'::jsonb
  ),
  updated_at = timezone('utc', now())
where exists (
  select 1
  from jsonb_array_elements(photos) as items(photo)
  where
    jsonb_typeof(photo) <> 'object'
    or nullif(photo ->> 'storagePath', '') is null
);
