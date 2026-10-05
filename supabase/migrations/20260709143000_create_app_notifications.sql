create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  source_key text,
  category text not null default 'system',
  notification_type text not null,
  title text not null,
  message text not null,
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'danger')),
  entity_type text,
  entity_id text,
  action_href text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists app_notifications_source_key_unique_idx
  on public.app_notifications(source_key)
  where source_key is not null;

create index if not exists app_notifications_read_created_idx
  on public.app_notifications(read_at, created_at desc);

create index if not exists app_notifications_category_created_idx
  on public.app_notifications(category, created_at desc);

alter table public.app_notifications enable row level security;

drop policy if exists "Authenticated users can read notifications"
  on public.app_notifications;

create policy "Authenticated users can read notifications"
  on public.app_notifications for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update notifications"
  on public.app_notifications;

create policy "Authenticated users can update notifications"
  on public.app_notifications for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

do $$
begin
  begin
    alter publication supabase_realtime add table public.app_notifications;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

notify pgrst, 'reload schema';
