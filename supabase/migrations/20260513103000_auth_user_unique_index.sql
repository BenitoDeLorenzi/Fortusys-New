create unique index if not exists app_users_auth_user_id_unique_idx
  on public.app_users(auth_user_id)
  where auth_user_id is not null;
