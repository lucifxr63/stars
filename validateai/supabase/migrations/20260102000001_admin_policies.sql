-- Admin helper function
create or replace function public.is_admin()
returns boolean as $$
begin
  return (
    select email = 'lucianoalonso2000@gmail.com'
    from auth.users
    where id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- Admin can read all profiles
create policy "Admin can read all profiles"
  on public.profiles for select
  using (public.is_admin());

-- Admin can read all validations
create policy "Admin can read all validations"
  on public.validations for select
  using (public.is_admin());

-- Admin can read all AI interactions
create policy "Admin can read all ai_interactions"
  on public.ai_interactions for select
  using (public.is_admin());
