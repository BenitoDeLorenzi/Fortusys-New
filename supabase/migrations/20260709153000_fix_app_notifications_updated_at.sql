alter table public.app_notifications
  add column if not exists updated_at timestamptz not null default now();

drop index if exists app_notifications_source_key_unique_idx;
drop index if exists app_events_source_key_unique_idx;
drop index if exists app_notifications_user_source_key_unique_idx;

create unique index app_events_source_key_unique_idx
  on public.app_events(source_key);

create unique index app_notifications_user_source_key_unique_idx
  on public.app_notifications(user_id, source_key);

notify pgrst, 'reload schema';
