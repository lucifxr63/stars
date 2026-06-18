-- Fix: el admin no podía cambiar el tier de OTROS usuarios desde /admin.
-- profiles solo tenía UPDATE policy "Users can update own profile" USING (auth.uid() = id),
-- y la 002_admin_policies.sql daba a admin SELECT pero NO UPDATE.
-- Resultado: el UPDATE sobre la fila ajena pasaba el filtro RLS → 0 filas afectadas,
-- sin error → el cambio parecía aplicarse (estado optimista) pero se perdía en el F5.
-- Las policies son permisivas (OR), así que esto convive con la policy de "own profile".

create policy "Admin can update all profiles"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());
