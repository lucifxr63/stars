-- Fix: el upsert client-side de profiles (AuthCallback.tsx) emite
-- INSERT ... ON CONFLICT (id) DO UPDATE. PostgREST exige una policy INSERT
-- con WITH CHECK aunque la fila ya exista (la crea el trigger handle_new_user,
-- que es SECURITY DEFINER y por eso bypassa RLS). Sin esta policy → 403.

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
