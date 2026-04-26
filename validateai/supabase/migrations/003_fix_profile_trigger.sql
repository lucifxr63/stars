-- Fix handle_new_user: Google OAuth stores name in 'name', not 'full_name'
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
    set
      full_name = coalesce(
        excluded.full_name,
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name'
      ),
      avatar_url = coalesce(excluded.avatar_url, new.raw_user_meta_data->>'avatar_url'),
      updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

-- Backfill existing users that have null full_name
UPDATE public.profiles p
SET
  full_name = coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name'
  ),
  avatar_url = u.raw_user_meta_data->>'avatar_url',
  updated_at = now()
FROM auth.users u
WHERE p.id = u.id AND p.full_name IS NULL;
