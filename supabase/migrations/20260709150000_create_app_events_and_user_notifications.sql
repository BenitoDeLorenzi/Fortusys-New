create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  source_key text,
  actor_user_id uuid references public.app_users(id) on delete set null,
  category text not null default 'system',
  event_type text not null,
  title text not null,
  message text not null,
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'danger')),
  entity_type text,
  entity_id text,
  action_href text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.app_notifications
  add column if not exists event_id uuid references public.app_events(id) on delete cascade,
  add column if not exists user_id uuid references public.app_users(id) on delete cascade,
  add column if not exists actor_user_id uuid references public.app_users(id) on delete set null,
  add column if not exists is_silent boolean not null default false;

drop index if exists app_notifications_source_key_unique_idx;

create unique index if not exists app_events_source_key_unique_idx
  on public.app_events(source_key)
  where source_key is not null;

create unique index if not exists app_notifications_user_source_key_unique_idx
  on public.app_notifications(user_id, source_key)
  where user_id is not null and source_key is not null;

create index if not exists app_events_category_created_idx
  on public.app_events(category, created_at desc);

create index if not exists app_events_actor_created_idx
  on public.app_events(actor_user_id, created_at desc);

create index if not exists app_notifications_user_read_created_idx
  on public.app_notifications(user_id, read_at, created_at desc);

create index if not exists app_notifications_event_id_idx
  on public.app_notifications(event_id);

alter table public.app_events enable row level security;

drop policy if exists "Authenticated users can read notifications"
  on public.app_notifications;

create policy "Authenticated users can read own notifications"
  on public.app_notifications for select
  using (
    exists (
      select 1
      from public.app_users
      where app_users.id = app_notifications.user_id
        and app_users.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Authenticated users can update notifications"
  on public.app_notifications;

create policy "Authenticated users can update own notifications"
  on public.app_notifications for update
  using (
    exists (
      select 1
      from public.app_users
      where app_users.id = app_notifications.user_id
        and app_users.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.app_users
      where app_users.id = app_notifications.user_id
        and app_users.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Authenticated users can read app events"
  on public.app_events;

create policy "Authenticated users can read app events"
  on public.app_events for select
  using (auth.role() = 'authenticated');

do $$
begin
  begin
    alter publication supabase_realtime add table public.app_events;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

notify pgrst, 'reload schema';
